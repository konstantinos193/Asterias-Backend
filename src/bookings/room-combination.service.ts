import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../models/room.model';
import { Booking, BookingDocument } from '../models/booking.model';

export interface RoomInventoryItem {
  id: string;
  name: string;
  nameKey: string;
  maxOccupancy: number;
  price: number;
  available: number;
  pricingByOccupancy: { guests: number; price: number }[];
}

export interface RoomCombination {
  rooms: {
    roomId: string;
    roomName: string;
    count: number;
    occupancy: number;
    pricePerRoom: number;
    totalPrice: number;
  }[];
  totalCapacity: number;
  totalPrice: number;
  unusedBeds: number;
  score: number;
  combinationType: 'cheapest' | 'best_value' | 'most_comfortable';
}

export interface CombinationRequest {
  adults: number;
  children: number;
  checkIn: Date;
  checkOut: Date;
  maxCombinations?: number;
  preferMultiRoom?: boolean;
}

@Injectable()
export class RoomCombinationService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>
  ) {}

  /**
   * Build room inventory with availability for given dates
   */
  async buildRoomInventory(checkIn: Date, checkOut: Date, guestCount?: number): Promise<RoomInventoryItem[]> {
    const rooms = await this.roomModel.find({ totalRooms: { $gt: 0 } }).exec();
    const inventory: RoomInventoryItem[] = [];

    for (const room of rooms) {
      const availableCount = await this.getAvailableRoomCount(room._id.toString(), checkIn, checkOut);
      
      if (availableCount > 0) {
        inventory.push({
          id: room._id.toString(),
          name: room.name,
          nameKey: room.nameKey,
          maxOccupancy: room.capacity,
          price: room.price,
          available: availableCount,
          pricingByOccupancy: room.pricingByOccupancy || []
        });
      }
    }

    // Sort by actual price for the guest count if provided, otherwise by base price
    if (guestCount) {
      return inventory.sort((a, b) => {
        const priceA = this.getPriceForOccupancy(a, guestCount);
        const priceB = this.getPriceForOccupancy(b, guestCount);
        
        // Prioritize rooms with occupancy pricing
        const aHasOccupancyPricing = a.pricingByOccupancy && a.pricingByOccupancy.length > 0;
        const bHasOccupancyPricing = b.pricingByOccupancy && b.pricingByOccupancy.length > 0;
        
        // STRONG PRIORITY: If room A has exact occupancy pricing for this guest count, put it first
        const aHasExactPricing = a.pricingByOccupancy && a.pricingByOccupancy.some(p => p.guests === guestCount);
        const bHasExactPricing = b.pricingByOccupancy && b.pricingByOccupancy.some(p => p.guests === guestCount);
        
        if (aHasExactPricing && !bHasExactPricing) return -1;
        if (!aHasExactPricing && bHasExactPricing) return 1;
        
        // Then prioritize any occupancy pricing over none
        if (aHasOccupancyPricing && !bHasOccupancyPricing) return -1;
        if (!aHasOccupancyPricing && bHasOccupancyPricing) return 1;
        
        // Finally sort by price
        return priceA - priceB;
      });
    }
    
    return inventory.sort((a, b) => a.price - b.price);
  }

  /**
   * Get available room count for specific room type and dates
   */
  private async getAvailableRoomCount(roomId: string, checkIn: Date, checkOut: Date): Promise<number> {
    const room = await this.roomModel.findById(roomId);
    if (!room) return 0;

    const bookedCount = await this.bookingModel.countDocuments({
      roomId: new (require('mongoose').Types.ObjectId)(roomId),
      bookingStatus: { $nin: ['CANCELLED'] },
      $or: [
        { checkIn: { $lt: checkOut, $gte: checkIn } },
        { checkOut: { $gt: checkIn, $lte: checkOut } },
        { checkIn: { $lte: checkIn }, checkOut: { $gte: checkOut } }
      ]
    });

    return Math.max(0, room.totalRooms - bookedCount);
  }

  /**
   * Generate all valid room combinations for given guest count
   */
  async generateOptimalCombinations(request: CombinationRequest): Promise<RoomCombination[]> {
    const { adults, children, checkIn, checkOut, maxCombinations = 10, preferMultiRoom = true } = request;
    const totalGuests = adults + children;
    
    const inventory = await this.buildRoomInventory(checkIn, checkOut, totalGuests);
    
    if (inventory.length === 0) {
      return [];
    }

    const combinations: RoomCombination[] = [];

    if (preferMultiRoom) {
      // Generate BOTH single and multi-room options for comparison
      combinations.push(...await this.generateMultiRoomCombinations(inventory, totalGuests));
      const singleRoomOption = await this.generateSingleRoomOption(inventory, totalGuests);
      if (singleRoomOption) {
        combinations.push(singleRoomOption);
      }
    } else {
      // LEGACY: Generate all combinations (including single rooms)
      combinations.push(...await this.generateCheapestCombinations(inventory, totalGuests));
      combinations.push(...await this.generateBestValueCombinations(inventory, totalGuests));
      combinations.push(...await this.generateMostComfortableCombinations(inventory, totalGuests));
    }

    // Remove duplicates and sort by score
    const uniqueCombinations = this.removeDuplicateCombinations(combinations);
    const sortedCombinations = uniqueCombinations
      .sort((a, b) => a.score - b.score)
      .slice(0, maxCombinations);

    return sortedCombinations;
  }

  /**
   * Generate multi-room combinations ONLY (no single rooms)
   */
  private async generateMultiRoomCombinations(inventory: RoomInventoryItem[], totalGuests: number): Promise<RoomCombination[]> {
    const combinations: RoomCombination[] = [];

    // Strategy: Try combinations of 2 rooms of the same type
    for (const room of inventory) {
      if (room.available >= 2) {
        // Can use 2 rooms of the same type
        const totalCapacity = 2 * room.maxOccupancy;
        if (totalCapacity >= totalGuests) {
          const guestsPerRoom = Math.ceil(totalGuests / 2);
          const pricePerRoom = this.getPriceForOccupancy(room, guestsPerRoom);
          const totalPrice = pricePerRoom * 2;
          const unusedBeds = totalCapacity - totalGuests;
          const score = totalPrice + (unusedBeds * 10);

          combinations.push({
            rooms: [
              {
                roomId: room.id,
                roomName: room.name,
                count: 1,
                occupancy: guestsPerRoom,
                pricePerRoom,
                totalPrice: pricePerRoom
              },
              {
                roomId: room.id,
                roomName: room.name,
                count: 1,
                occupancy: guestsPerRoom,
                pricePerRoom,
                totalPrice: pricePerRoom
              }
            ],
            totalCapacity,
            totalPrice,
            unusedBeds,
            score,
            combinationType: 'best_value'
          });
        }
      }
    }

    // Strategy: Try combinations of different room types
    for (let i = 0; i < inventory.length; i++) {
      for (let j = i + 1; j < inventory.length; j++) {
        const room1 = inventory[i];
        const room2 = inventory[j];
        
        if (room1.available > 0 && room2.available > 0) {
          const totalCapacity = room1.maxOccupancy + room2.maxOccupancy;
          if (totalCapacity >= totalGuests) {
            const room1Details = {
              roomId: room1.id,
              roomName: room1.name,
              count: 1,
              occupancy: Math.min(room1.maxOccupancy, totalGuests),
              pricePerRoom: this.getPriceForOccupancy(room1, Math.min(room1.maxOccupancy, totalGuests)),
              totalPrice: this.getPriceForOccupancy(room1, Math.min(room1.maxOccupancy, totalGuests))
            };
            
            const room2Details = {
              roomId: room2.id,
              roomName: room2.name,
              count: 1,
              occupancy: Math.min(room2.maxOccupancy, Math.max(0, totalGuests - room1.maxOccupancy)),
              pricePerRoom: this.getPriceForOccupancy(room2, Math.min(room2.maxOccupancy, Math.max(0, totalGuests - room1.maxOccupancy))),
              totalPrice: this.getPriceForOccupancy(room2, Math.min(room2.maxOccupancy, Math.max(0, totalGuests - room1.maxOccupancy)))
            };

            const totalPrice = room1Details.totalPrice + room2Details.totalPrice;
            const unusedBeds = totalCapacity - totalGuests;
            const score = totalPrice + (unusedBeds * 10);

            combinations.push({
              rooms: [room1Details, room2Details],
              totalCapacity,
              totalPrice,
              unusedBeds,
              score,
              combinationType: 'best_value'
            });
          }
        }
      }
    }

    return combinations.filter(combo => combo.rooms.length > 1);
  }

  /**
   * Generate single-room option ONLY as fallback
   */
  private async generateSingleRoomOption(inventory: RoomInventoryItem[], totalGuests: number): Promise<RoomCombination | null> {
    // Find the first room that fits (inventory is already sorted by priority)
    // Check both max occupancy AND if room has exact pricing for this guest count
    const singleRoom = inventory.find(room => {
      const canAccommodate = room.maxOccupancy >= totalGuests && room.available >= 1;
      if (!canAccommodate) return false;
      
      // If room has occupancy pricing, check if it has exact pricing for this guest count
      if (room.pricingByOccupancy && room.pricingByOccupancy.length > 0) {
        return room.pricingByOccupancy.some(p => p.guests === totalGuests);
      }
      
      // Otherwise, use base capacity logic
      return true;
    });
    
    if (singleRoom) {
      return this.createCombination([{
        roomId: singleRoom.id,
        roomName: singleRoom.name,
        count: 1,
        occupancy: Math.min(totalGuests, singleRoom.maxOccupancy),
        pricePerRoom: this.getPriceForOccupancy(singleRoom, totalGuests),
        totalPrice: this.getPriceForOccupancy(singleRoom, totalGuests)
      }], totalGuests, 'cheapest');
    }
    return null;
  }
  private async generateCheapestCombinations(inventory: RoomInventoryItem[], totalGuests: number): Promise<RoomCombination[]> {
    const combinations: RoomCombination[] = [];

    // Strategy 1: Find single room that fits all guests (inventory is already prioritized)
    // Check both max occupancy AND if room has exact pricing for this guest count
    const singleRoom = inventory.find(room => {
      const canAccommodate = room.maxOccupancy >= totalGuests && room.available >= 1;
      if (!canAccommodate) return false;
      
      // If room has occupancy pricing, check if it has exact pricing for this guest count
      if (room.pricingByOccupancy && room.pricingByOccupancy.length > 0) {
        return room.pricingByOccupancy.some(p => p.guests === totalGuests);
      }
      
      // Otherwise, use base capacity logic
      return true;
    });
    
    if (singleRoom) {
      combinations.push(this.createCombination([{
        roomId: singleRoom.id,
        roomName: singleRoom.name,
        count: 1,
        occupancy: Math.min(totalGuests, singleRoom.maxOccupancy),
        pricePerRoom: this.getPriceForOccupancy(singleRoom, totalGuests),
        totalPrice: this.getPriceForOccupancy(singleRoom, totalGuests)
      }], totalGuests, 'cheapest'));
    }

    // Strategy 2: Multiple smaller rooms
    const smallestRooms = inventory.filter(room => room.maxOccupancy < totalGuests);
    if (smallestRooms.length > 0) {
      const multiRoomCombo = this.findBestMultiRoomCombination(smallestRooms, totalGuests, 'price');
      if (multiRoomCombo) {
        combinations.push(multiRoomCombo);
      }
    }

    return combinations;
  }

  /**
   * Generate best value combinations (good price-to-comfort ratio)
   */
  private async generateBestValueCombinations(inventory: RoomInventoryItem[], totalGuests: number): Promise<RoomCombination[]> {
    const combinations: RoomCombination[] = [];

    // Strategy: Balance between price and comfort
    const candidateRooms = inventory.filter(room => room.available >= 1);
    
    // Try different room counts
    for (let roomCount = 1; roomCount <= Math.ceil(totalGuests / 2); roomCount++) {
      const combo = this.findFixedRoomCountCombination(candidateRooms, totalGuests, roomCount);
      if (combo) {
        combinations.push(combo);
      }
    }

    return combinations;
  }

  /**
   * Generate most comfortable combinations (minimize unused beds)
   */
  private async generateMostComfortableCombinations(inventory: RoomInventoryItem[], totalGuests: number): Promise<RoomCombination[]> {
    const combinations: RoomCombination[] = [];

    // Strategy: Minimize unused beds even if slightly more expensive
    const bestFitCombo = this.findBestMultiRoomCombination(inventory, totalGuests, 'fit');
    if (bestFitCombo) {
      combinations.push(bestFitCombo);
    }

    return combinations;
  }

  /**
   * Find best multi-room combination based on strategy
   */
  private findBestMultiRoomCombination(inventory: RoomInventoryItem[], totalGuests: number, strategy: 'price' | 'fit'): RoomCombination | null {
    let bestCombination: RoomCombination | null = null;
    let bestScore = strategy === 'price' ? Infinity : -1;

    // Try combinations of 2-4 rooms
    for (let roomCount = 2; roomCount <= Math.min(4, Math.ceil(totalGuests)); roomCount++) {
      const combination = this.findFixedRoomCountCombination(inventory, totalGuests, roomCount);
      
      if (combination) {
        const score = strategy === 'price' ? combination.totalPrice : -combination.unusedBeds;
        
        if ((strategy === 'price' && score < bestScore) || 
            (strategy === 'fit' && score > bestScore)) {
          bestScore = score;
          bestCombination = combination;
        }
      }
    }

    return bestCombination;
  }

  /**
   * Find combination with fixed number of rooms
   */
  private findFixedRoomCountCombination(inventory: RoomInventoryItem[], totalGuests: number, targetRoomCount: number): RoomCombination | null {
    // Simple greedy approach - can be optimized with DP for production
    const sortedRooms = inventory.sort((a, b) => b.maxOccupancy - a.maxOccupancy);
    const selectedRooms: typeof inventory[0][] = [];
    let remainingGuests = totalGuests;

    for (const room of sortedRooms) {
      if (selectedRooms.length >= targetRoomCount) break;
      if (room.available === 0) continue;

      const roomsNeeded = Math.min(
        Math.ceil(remainingGuests / room.maxOccupancy),
        room.available,
        targetRoomCount - selectedRooms.length
      );

      if (roomsNeeded > 0) {
        selectedRooms.push(room);
        remainingGuests -= roomsNeeded * room.maxOccupancy;
      }
    }

    if (remainingGuests > 0 || selectedRooms.length !== targetRoomCount) {
      return null;
    }

    const roomDetails = selectedRooms.map(room => ({
      roomId: room.id,
      roomName: room.name,
      count: 1,
      occupancy: Math.min(room.maxOccupancy, totalGuests),
      pricePerRoom: this.getPriceForOccupancy(room, Math.min(room.maxOccupancy, totalGuests)),
      totalPrice: this.getPriceForOccupancy(room, Math.min(room.maxOccupancy, totalGuests))
    }));

    return this.createCombination(roomDetails, totalGuests, 'best_value');
  }

  /**
   * Create combination object with calculated score
   */
  private createCombination(roomDetails: any[], totalGuests: number, type: RoomCombination['combinationType']): RoomCombination {
    const totalCapacity = roomDetails.reduce((sum, room) => sum + room.occupancy, 0);
    const totalPrice = roomDetails.reduce((sum, room) => sum + room.totalPrice, 0);
    const unusedBeds = Math.max(0, totalCapacity - totalGuests);
    
    // Score function: lower is better
    const score = totalPrice + (unusedBeds * 10); // Penalty for unused beds

    return {
      rooms: roomDetails,
      totalCapacity,
      totalPrice,
      unusedBeds,
      score,
      combinationType: type
    };
  }

  /**
   * Get price for specific occupancy level
   */
  private getPriceForOccupancy(room: RoomInventoryItem, guests: number): number {
    // First try to find exact match for guest count
    const exactPricing = room.pricingByOccupancy.find(p => p.guests === guests);
    if (exactPricing) {
      return exactPricing.price;
    }
    
    // If no exact match, find the cheapest option that can accommodate the guests
    const suitablePricing = room.pricingByOccupancy
      .filter(p => p.guests >= guests)
      .sort((a, b) => a.price - b.price)[0];
    
    return suitablePricing ? suitablePricing.price : room.price;
  }

  /**
   * Remove duplicate combinations
   */
  private removeDuplicateCombinations(combinations: RoomCombination[]): RoomCombination[] {
    const seen = new Set<string>();
    const unique: RoomCombination[] = [];

    for (const combo of combinations) {
      const signature = combo.rooms
        .map(r => `${r.roomId}:${r.count}`)
        .sort()
        .join('|');

      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(combo);
      }
    }

    return unique;
  }

  /**
   * Quick hack for backward compatibility - return best combination (not single room)
   */
  async findBestRoom(adults: number, children: number, checkIn: Date, checkOut: Date): Promise<Room | null> {
    const totalGuests = adults + children;
    const inventory = await this.buildRoomInventory(checkIn, checkOut, totalGuests);

    // First try to find multi-room combinations
    const multiRoomCombos = await this.generateMultiRoomCombinations(inventory, totalGuests);
    
    if (multiRoomCombos.length > 0) {
      // Return the cheapest room from the best combination
      const bestCombo = multiRoomCombos[0];
      const cheapestRoomId = bestCombo.rooms[0].roomId;
      return this.roomModel.findById(cheapestRoomId);
    }

    // Fallback: only if no multi-room combinations exist
    const suitableRooms = inventory.filter(room => room.maxOccupancy >= totalGuests && room.available >= 1);
    
    if (suitableRooms.length === 0) {
      // Last resort: return cheapest available room
      const cheapestRoom = inventory.find(room => room.available >= 1);
      return cheapestRoom ? this.roomModel.findById(cheapestRoom.id) : null;
    }

    // Return cheapest suitable room
    const cheapestRoomId = suitableRooms.sort((a, b) => a.price - b.price)[0].id;
    return this.roomModel.findById(cheapestRoomId);
  }
}
