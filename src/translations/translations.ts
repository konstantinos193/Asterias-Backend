// Email translations for multilingual support
const translations = {
  el: {
    // Customer booking confirmation
    bookingConfirmation: {
      subject: "Επιβεβαίωση Κράτησης - Asterias Homes",
      greeting: "Αγαπητέ/ή",
      confirmationText: "Η κράτησή σας επιβεβαιώθηκε! Εδώ είναι τα στοιχεία:",
      bookingDetails: "Στοιχεία Κράτησης",
      bookingCode: "Κωδικός Κράτησης",
      room: "Δωμάτιο",
      arrival: "Άφιξη",
      departure: "Αναχώρηση",
      guests: "Επισκέπτες",
      totalCost: "Συνολικό Κόστος",
      arrivalInfo: "Πληροφορίες Άφιξης",
      address: "Διεύθυνση",
      checkIn: "Check-in",
      checkOut: "Check-out",
      questionsText: "Για οποιαδήποτε ερώτηση, επικοινωνήστε μαζί μας:",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      lookingForward: "Ανυπομονούμε να σας φιλοξενήσουμε!",
      doNotReply: "⚠️ Αυτό είναι αυτόματο email - παρακαλώ μην απαντήσετε σε αυτή τη διεύθυνση",
      footer: "Asterias Homes - Παραδοσιακά διαμερίσματα στην Κορωνησία Άρτας"
    },
    
    // Customer arrival reminder
    arrivalReminder: {
      subject: "Υπενθύμιση Άφιξης - Asterias Homes",
      greeting: "Αγαπητέ/ή",
      reminderText: "Ελπίζουμε να είστε καλά! Αυτή είναι μια φιλική υπενθύμιση για την επικείμενη άφιξή σας.",
      arrivalDetails: "Στοιχεία Άφιξης",
      date: "Ημερομηνία",
      time: "Ώρα",
      room: "Δωμάτιο",
      bookingCode: "Κωδικός Κράτησης",
      importantInfo: "Σημαντικές Πληροφορίες",
      keyPickup: "Παράδοση Κλειδιών",
      keyPickupText: "Θα σας περιμένουμε στο κατάλυμα για την παράδοση των κλειδιών",
      phone: "Τηλέφωνο Επικοινωνίας",
      contactInfo: "Για οποιαδήποτε αλλαγή ή καθυστέρηση, παρακαλώ ενημερώστε μας",
      goodTrip: "Σας ευχόμαστε ένα ασφαλές ταξίδι και ανυπομονούμε να σας δούμε!",
      doNotReply: "⚠️ Αυτό είναι αυτόματο email - παρακαλώ μην απαντήσετε σε αυτή τη διεύθυνση",
      footer: "Asterias Homes - Παραδοσιακά διαμερίσματα στην Κορωνησία Άρτας"
    },
    
    // Admin new booking alert
    newBookingAlert: {
      subject: "🚨 Νέα Κράτηση - Asterias Homes",
      title: "Νέα Κράτηση Πραγματοποιήθηκε!",
      bookingDetails: "Στοιχεία Κράτησης",
      code: "Κωδικός",
      customer: "Πελάτης",
      email: "Email",
      phone: "Τηλέφωνο",
      room: "Δωμάτιο",
      arrival: "Άφιξη",
      departure: "Αναχώρηση",
      guests: "Επισκέπτες",
      total: "Σύνολο",
      bookedAt: "Κρατήθηκε στις"
    }
  },
  
  en: {
    // Customer booking confirmation
    bookingConfirmation: {
      subject: "Booking Confirmation - Asterias Homes",
      greeting: "Dear",
      confirmationText: "Your booking has been confirmed! Here are the details:",
      bookingDetails: "Booking Details",
      bookingCode: "Booking Code",
      room: "Room",
      arrival: "Arrival",
      departure: "Departure",
      guests: "Guests",
      totalCost: "Total Cost",
      arrivalInfo: "Arrival Information",
      address: "Address",
      checkIn: "Check-in",
      checkOut: "Check-out",
      questionsText: "For any questions, please contact us:",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      lookingForward: "We look forward to hosting you!",
      doNotReply: "⚠️ This is an automated email - please do not reply to this address",
      footer: "Asterias Homes - Traditional apartments in Koronisia, Arta"
    },
    
    // Customer arrival reminder
    arrivalReminder: {
      subject: "Arrival Reminder - Asterias Homes",
      greeting: "Dear",
      reminderText: "Hope you're doing well! This is a friendly reminder for your upcoming arrival.",
      arrivalDetails: "Arrival Details",
      date: "Date",
      time: "Time",
      room: "Room",
      bookingCode: "Booking Code",
      importantInfo: "Important Information",
      keyPickup: "Key Pickup",
      keyPickupText: "We will wait for you at the property to hand over the keys",
      phone: "Contact Phone",
      contactInfo: "For any changes or delays, please let us know",
      goodTrip: "We wish you a safe trip and look forward to seeing you!",
      doNotReply: "⚠️ This is an automated email - please do not reply to this address",
      footer: "Asterias Homes - Traditional apartments in Koronisia, Arta"
    },
    
    // Admin new booking alert
    newBookingAlert: {
      subject: "🚨 New Booking - Asterias Homes",
      title: "New Booking Made!",
      bookingDetails: "Booking Details",
      code: "Code",
      customer: "Customer",
      email: "Email",
      phone: "Phone",
      room: "Room",
      arrival: "Arrival",
      departure: "Departure",
      guests: "Guests",
      total: "Total",
      bookedAt: "Booked at"
    }
  },
  
  de: {
    // Customer booking confirmation
    bookingConfirmation: {
      subject: "Buchungsbestätigung - Asterias Homes",
      greeting: "Sehr geehrte/r",
      confirmationText: "Ihre Buchung wurde bestätigt! Hier sind die Details:",
      bookingDetails: "Buchungsdetails",
      bookingCode: "Buchungscode",
      room: "Zimmer",
      arrival: "Ankunft",
      departure: "Abreise",
      guests: "Gäste",
      totalCost: "Gesamtkosten",
      arrivalInfo: "Ankunftsinformationen",
      address: "Adresse",
      checkIn: "Check-in",
      checkOut: "Check-out",
      questionsText: "Bei Fragen kontaktieren Sie uns bitte:",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      lookingForward: "Wir freuen uns darauf, Sie zu beherbergen!",
      doNotReply: "⚠️ Dies ist eine automatische E-Mail - bitte antworten Sie nicht auf diese Adresse",
      footer: "Asterias Homes - Traditionelle Apartments in Koronisia, Arta"
    },
    
    // Customer arrival reminder
    arrivalReminder: {
      subject: "Ankunfts-Erinnerung - Asterias Homes",
      greeting: "Sehr geehrte/r",
      reminderText: "Wir hoffen, es geht Ihnen gut! Dies ist eine freundliche Erinnerung an Ihre bevorstehende Ankunft.",
      arrivalDetails: "Ankunftsdetails",
      date: "Datum",
      time: "Zeit",
      room: "Zimmer",
      bookingCode: "Buchungscode",
      importantInfo: "Wichtige Informationen",
      keyPickup: "Schlüsselübergabe",
      keyPickupText: "Wir warten auf Sie in der Unterkunft zur Schlüsselübergabe",
      phone: "Kontakt-Telefon",
      contactInfo: "Bei Änderungen oder Verspätungen informieren Sie uns bitte",
      goodTrip: "Wir wünschen Ihnen eine sichere Reise und freuen uns darauf, Sie zu sehen!",
      doNotReply: "⚠️ Dies ist eine automatische E-Mail - bitte antworten Sie nicht auf diese Adresse",
      footer: "Asterias Homes - Traditionelle Apartments in Koronisia, Arta"
    },
    
    // Admin new booking alert
    newBookingAlert: {
      subject: "🚨 Neue Buchung - Asterias Homes",
      title: "Neue Buchung getätigt!",
      bookingDetails: "Buchungsdetails",
      code: "Code",
      customer: "Kunde",
      email: "E-Mail",
      phone: "Telefon",
      room: "Zimmer",
      arrival: "Ankunft",
      departure: "Abreise",
      guests: "Gäste",
      total: "Gesamt",
      bookedAt: "Gebucht am"
    }
  }
};

// Translation function
export function t(language: string, category: string, key: string): string {
  try {
    const langData = translations[language as keyof typeof translations];
    if (!langData) {
      console.warn(`Language '${language}' not found, falling back to Greek`);
      return translations.el[category as keyof typeof translations.el]?.[key as keyof typeof translations.el.bookingConfirmation] || key;
    }
    
    const categoryData = langData[category as keyof typeof langData];
    if (!categoryData) {
      console.warn(`Category '${category}' not found for language '${language}'`);
      return key;
    }
    
    const value = categoryData[key as keyof typeof categoryData];
    if (!value) {
      console.warn(`Key '${key}' not found in category '${category}' for language '${language}'`);
      return key;
    }
    
    return value as string;
  } catch (error) {
    console.error('Translation error:', error);
    return key;
  }
}

export default translations;
