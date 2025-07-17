// Email translations for multilingual support
const emailTranslations = {
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
      reminderText: "Σας υπενθυμίζουμε ότι η άφιξή σας στο Asterias Homes είναι αύριο!",
      arrivalDetails: "Στοιχεία Άφιξης",
      date: "Ημερομηνία",
      time: "Ώρα Check-in",
      room: "Δωμάτιο",
      bookingCode: "Κωδικός Κράτησης",
      importantInfo: "Σημαντικές Πληροφορίες",
      address: "Διεύθυνση",
      keyPickup: "Παραλαβή Κλειδιών",
      keyPickupText: "Παρακαλώ επικοινωνήστε μαζί μας 30 λεπτά πριν την άφιξή σας",
      phone: "Τηλέφωνο",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      goodTrip: "Καλό ταξίδι και ανυπομονούμε να σας φιλοξενήσουμε!",
      doNotReply: "⚠️ Αυτό είναι αυτόματο email - παρακαλώ μην απαντήσετε σε αυτή τη διεύθυνση",
      footer: "Asterias Homes - Κορωνησία, Άρτα"
    },

    // Admin new booking alert
    newBookingAlert: {
      subject: "🏠 Νέα Κράτηση",
      title: "Νέα Κράτηση Παραλήφθηκε",
      bookingDetails: "Στοιχεία Κράτησης",
      code: "Κωδικός",
      customer: "Πελάτης",
      email: "Email",
      phone: "Τηλέφωνο",
      room: "Δωμάτιο",
      arrival: "Άφιξη",
      departure: "Αναχώρηση",
      guests: "Επισκέπτες",
      total: "Συνολικό",
      bookedAt: "Κρατήθηκε",
      status: "Κατάσταση",
      viewBooking: "Προβολή Κράτησης"
    },

    // Admin low inventory alert
    lowInventoryAlert: {
      subject: "⚠️ Χαμηλή Διαθεσιμότητα",
      title: "⚠️ Ειδοποίηση Χαμηλής Διαθεσιμότητας",
      text: "Η διαθεσιμότητα για την ημερομηνία είναι χαμηλή:",
      roomStatus: "Κατάσταση Δωματίων",
      totalAvailability: "Συνολική διαθεσιμότητα",
      viewBookings: "Προβολή Κρατήσεων"
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
      doNotReply: "⚠️ This is an automatic email - please do not reply to this address",
      footer: "Asterias Homes - Traditional apartments in Koronisia, Arta"
    },
    
    // Customer arrival reminder
    arrivalReminder: {
      subject: "Arrival Reminder - Asterias Homes",
      greeting: "Dear",
      reminderText: "We remind you that your arrival at Asterias Homes is tomorrow!",
      arrivalDetails: "Arrival Details",
      date: "Date",
      time: "Check-in Time",
      room: "Room",
      bookingCode: "Booking Code",
      importantInfo: "Important Information",
      address: "Address",
      keyPickup: "Key Pickup",
      keyPickupText: "Please contact us 30 minutes before your arrival",
      phone: "Phone",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      goodTrip: "Have a good trip and we look forward to hosting you!",
      doNotReply: "⚠️ This is an automatic email - please do not reply to this address",
      footer: "Asterias Homes - Koronisia, Arta"
    },

    // Admin new booking alert
    newBookingAlert: {
      subject: "🏠 New Booking",
      title: "New Booking Received",
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
      bookedAt: "Booked at",
      status: "Status",
      viewBooking: "View Booking"
    },

    // Admin low inventory alert
    lowInventoryAlert: {
      subject: "⚠️ Low Availability",
      title: "⚠️ Low Availability Alert",
      text: "Availability for the date is low:",
      roomStatus: "Room Status",
      totalAvailability: "Total availability",
      viewBookings: "View Bookings"
    }
  },

  de: {
    // Customer booking confirmation
    bookingConfirmation: {
      subject: "Buchungsbestätigung - Asterias Homes",
      greeting: "Liebe/r",
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
      doNotReply: "⚠️ Dies ist eine automatische E-Mail - bitte antworten Sie nicht an diese Adresse",
      footer: "Asterias Homes - Traditionelle Apartments in Koronisia, Arta"
    },
    
    // Customer arrival reminder
    arrivalReminder: {
      subject: "Ankunftserinnerung - Asterias Homes",
      greeting: "Liebe/r",
      reminderText: "Wir erinnern Sie daran, dass Ihre Ankunft im Asterias Homes morgen ist!",
      arrivalDetails: "Ankunftsdetails",
      date: "Datum",
      time: "Check-in Zeit",
      room: "Zimmer",
      bookingCode: "Buchungscode",
      importantInfo: "Wichtige Informationen",
      address: "Adresse",
      keyPickup: "Schlüsselübergabe",
      keyPickupText: "Bitte kontaktieren Sie uns 30 Minuten vor Ihrer Ankunft",
      phone: "Telefon",
      contactInfo: "📧 asterias.apartmentskoronisia@gmail.com | 📞 +30 6972705881",
      goodTrip: "Gute Reise und wir freuen uns darauf, Sie zu beherbergen!",
      doNotReply: "⚠️ Dies ist eine automatische E-Mail - bitte antworten Sie nicht an diese Adresse",
      footer: "Asterias Homes - Koronisia, Arta"
    },

    // Admin new booking alert
    newBookingAlert: {
      subject: "🏠 Neue Buchung",
      title: "Neue Buchung erhalten",
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
      bookedAt: "Gebucht am",
      status: "Status",
      viewBooking: "Buchung anzeigen"
    },

    // Admin low inventory alert
    lowInventoryAlert: {
      subject: "⚠️ Geringe Verfügbarkeit",
      title: "⚠️ Warnung bei geringer Verfügbarkeit",
      text: "Die Verfügbarkeit für das Datum ist gering:",
      roomStatus: "Zimmerstatus",
      totalAvailability: "Gesamtverfügbarkeit",
      viewBookings: "Buchungen anzeigen"
    }
  }
};

// Helper function to get translations for a specific language
function getEmailTranslations(language = 'el') {
  return emailTranslations[language] || emailTranslations.el;
}

// Helper function to get translated text
function t(language, template, key) {
  const translations = getEmailTranslations(language);
  return translations[template]?.[key] || emailTranslations.el[template]?.[key] || key;
}

module.exports = {
  emailTranslations,
  getEmailTranslations,
  t
}; 