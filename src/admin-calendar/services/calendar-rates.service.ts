import { BadRequestException, Injectable } from '@nestjs/common';
import { buildDates, nightsBetween } from '../../availability/availability-rules';
import { PricingService, RateCalendar } from '../../pricing/pricing.service';
import { MAX_GRID_NIGHTS } from '../calendar.constants';
import { UpdateRatesDto } from '../dto/rates.dto';
import { planRateOverrides, TierPriceInput } from '../lib/rate-overrides';
import { CalendarRatesRepository } from '../repositories/calendar-rates.repository';

@Injectable()
export class CalendarRatesService {
  constructor(
    private readonly rates: CalendarRatesRepository,
    private readonly pricing: PricingService,
  ) {}

  /**
   * One price, or a whole range of them. A single night sends from === to, so
   * typing a rate on one date and dragging across August take the same path.
   */
  async update(dto: UpdateRatesDto): Promise<RateCalendar> {
    const nights = nightsBetween(dto.from, dto.to) + 1;
    if (nights < 1) {
      throw new BadRequestException('Η ημερομηνία λήξης πρέπει να είναι ίδια ή μετά την έναρξη');
    }
    if (nights > MAX_GRID_NIGHTS) {
      throw new BadRequestException(`Οι τιμές ορίζονται για έως ${MAX_GRID_NIGHTS} νύχτες τη φορά`);
    }

    const requested = dto.prices as TierPriceInput;
    if (!Object.keys(requested).length) {
      throw new BadRequestException('Δεν δόθηκε τιμή');
    }

    const dates = buildDates(dto.from, nights);
    const existing = await this.rates.listOverrides(dto.from, dto.to);
    await this.rates.apply(planRateOverrides(dates, requested, existing));

    // Prices do not change availability, but the calendar watches one counter
    // for "something moved", and a new rate has to reach the other open tabs.

    return this.pricing.rateCalendar(dto.from, nights);
  }
}
