import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, mongo } from 'mongoose';
import { Review } from '../models/review.model';

@Injectable()
export class ReviewsSeedService {
  constructor(@InjectModel(Review.name) private reviewModel: Model<Review>) {}

  async seedBookingReviews() {
    console.log('Seeding Booking.com reviews for Asterias...');
    const bookingReviews = [
      {
        reviewerName: 'Kakiousis',
        reviewText: 'Very convenient large apartments, quiet location, you can see the sea 150 meters away, Vasilis is extremely helpful and kind. Very close to taverns and coffee shops - you can walk. Koronisia is incredible, unique and magical on its own. We will definitely come back...',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'kakiousis_booking_1',
        reviewerType: 'FAMILY' as const,
        reviewDate: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000), // 2 months ago (Aug 2025)
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: true,
        verified: true,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/kakiousis-1.jpg',
          'https://asterias-backend.onrender.com/review-photos/kakiousis-2.jpg',
          'https://asterias-backend.onrender.com/review-photos/kakiousis-3.jpg',
          'https://asterias-backend.onrender.com/review-photos/kakiousis-4.jpg'
        ],
        translations: {
          el: 'Very convenient large apartments, quiet location, you can see the sea 150 meters away, Vasilis is extremely helpful and kind. Very close to taverns and coffee shops - you can walk. Koronisia is incredible, unique and magical on its own. We will definitely come back...',
          en: 'Very convenient large apartments, quiet location, you can see the sea 150 meters away, Vasilis is extremely helpful and kind. Very close to taverns and coffee shops - you can walk. Koronisia is incredible, unique and magical on its own. We will definitely come back...',
          de: 'Sehr bequeme große Wohnungen, ruhige Lage, man kann das Meer 150 Meter entfernt sehen, Vasilis ist extrem hilfsbereit und freundlich. Sehr nahe an Tavernen und Cafés - man kann zu Fuß gehen. Koronisia ist unglaublich, einzigartig und magisch für sich. Wir werden auf jeden Fall wiederkommen...'
        }
      },
      {
        reviewerName: 'Konstantinos',
        reviewText: 'Nice view\nComfortable rooms\nQuietness\nIdeal for families',
        rating: 8,
        source: 'booking' as const,
        sourceId: 'konstantinos_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000), // 8 months ago (Aug 2024)
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'Nice view\nComfortable rooms\nQuietness\nIdeal for families',
          en: 'Nice view\nComfortable rooms\nQuietness\nIdeal for families',
          de: 'Schöne Aussicht\nBequeme Zimmer\nRuhe\nIdeal für Familien'
        }
      },
      {
        reviewerName: 'Inna',
        reviewText: 'The location is very beautiful, it has coolness at night and beautiful view in the morning!',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'inna_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 10 * 30 * 24 * 60 * 60 * 1000), // 10 months ago (Jun 2024)
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'The location is very beautiful, it has coolness at night and beautiful view in the morning!',
          en: 'The location is very beautiful, it has coolness at night and beautiful view in the morning!',
          de: 'Der Ort ist sehr schön, er hat nachts Kühle und morgens eine schöne Aussicht!'
        }
      },
      {
        reviewerName: 'Michail',
        reviewText: 'Fantastic area, extremely kind hosts, present at every moment and particularly helpful in any need that arose.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'michail_booking_1',
        reviewerType: 'FAMILY' as const,
        reviewDate: new Date(Date.now() - 35 * 30 * 24 * 60 * 60 * 1000), // 35 months ago (May 2023)
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'Fantastic area, extremely kind hosts, present at every moment and particularly helpful in any need that arose.',
          en: 'Fantastic area, extremely kind hosts, present at every moment and particularly helpful in any need that arose.',
          de: 'Fantastischer Bereich, extrem nette Gastgeber, jederzeit präsent und besonders hilfsbereit bei jedem Bedarf, der auftrat.'
        }
      },
      {
        reviewerName: 'Eleni',
        reviewText: 'The service and the philotimo of Mrs. Dina\nThe comfortable stay\nEverything was excellent',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'eleni_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 36 months ago (May 2023)
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: true,
        verified: true,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/eleni-1.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-2.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-3.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-4.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-5.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-6.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-7.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-8.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-9.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-10.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-11.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-12.jpg',
          'https://asterias-backend.onrender.com/review-photos/eleni-13.jpg'
        ],
        translations: {
          el: 'The service and the philotimo of Mrs. Dina\nThe comfortable stay\nEverything was excellent',
          en: 'The service and the philotimo of Mrs. Dina\nThe comfortable stay\nEverything was excellent',
          de: 'Der Service und die Philotimo von Frau Dina\nDer komfortable Aufenthalt\nAlles war ausgezeichnet'
        }
      },
      {
        reviewerName: 'Kalliopi',
        reviewText: 'The location was excellent, the neighborhood very quiet and close to the sea, which you could see from the balcony. The hosts were very kind, hospitable and always available for any question we had about activities and the area. They were very helpful even when we needed their help after our stay at the apartment. Mrs. Konstantina\'s Easter cookies were excellent. We will definitely try to stay at the property again on a possible next visit.',
        rating: 9,
        source: 'booking' as const,
        sourceId: 'kalliopi_booking_1',
        reviewerType: 'FAMILY' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 36 months ago (Apr 2023)
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: true,
        translations: {
          el: 'The location was excellent, the neighborhood very quiet and close to the sea, which you could see from the balcony. The hosts were very kind, hospitable and always available for any question we had about activities and the area. They were very helpful even when we needed their help after our stay at the apartment. Mrs. Konstantina\'s Easter cookies were excellent. We will definitely try to stay at the property again on a possible next visit.',
          en: 'The location was excellent, the neighborhood very quiet and close to the sea, which you could see from the balcony. The hosts were very kind, hospitable and always available for any question we had about activities and the area. They were very helpful even when we needed their help after our stay at the apartment. Mrs. Konstantina\'s Easter cookies were excellent. We will definitely try to stay at the property again on a possible next visit.',
          de: 'Die Lage war hervorragend, die Nachbarschaft sehr ruhig und nahe am Meer, das man vom Balkon sehen konnte. Die Gastgeber waren sehr nett, gastfreundlich und immer verfügbar für jede Frage, die wir über Aktivitäten und die Gegend hatten. Sie waren sehr hilfsbereit, selbst als wir nach unserem Aufenthalt in der Wohnung ihre Hilfe brauchten. Die Osterkekse von Frau Konstantina waren ausgezeichnet. Wir werden auf jeden Fall versuchen, bei einer möglichen nächsten Wiederholung wieder in der Unterkunft zu übernachten.'
        }
      },
      {
        reviewerName: 'George',
        reviewText: 'Very clean and well-equipped room. Excellent hosts. Beautiful outdoor space.\nVery small and narrow space. The room clearly shows its age.',
        rating: 7,
        source: 'booking' as const,
        sourceId: 'george_booking_1',
        reviewerType: 'FAMILY' as const,
        reviewDate: new Date(Date.now() - 32 * 30 * 24 * 60 * 60 * 1000), // 32 months ago (Aug 2023)
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'Very clean and well-equipped room. Excellent hosts. Beautiful outdoor space.\nVery small and narrow space. The room clearly shows its age.',
          en: 'Very clean and well-equipped room. Excellent hosts. Beautiful outdoor space.\nVery small and narrow space. The room clearly shows its age.',
          de: 'Sehr sauberes und gut ausgestattetes Zimmer. Ausgezeichnete Gastgeber. Schöner Außenbereich.\nSehr kleiner und enger Raum. Das Zimmer zeigt deutlich sein Alter.'
        }
      },
      {
        reviewerName: 'John',
        reviewText: 'The property was very clean and warm, we went in January. The location is great. Very quiet. The breakfast was wonderful. Presented in a lovely basket with fruit, cereal, croissant, rusks, marmalade, butter and with a smile. It made our day.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'john_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000), // 2 months ago (Jan 2026)
        helpfulCount: 0,
        language: 'en',
        visible: true,
        featured: true,
        verified: true,
        translations: {
          el: 'The property was very clean and warm, we went in January. The location is great. Very quiet. The breakfast was wonderful. Presented in a lovely basket with fruit, cereal, croissant, rusks, marmalade, butter and with a smile. It made our day.',
          en: 'The property was very clean and warm, we went in January. The location is great. Very quiet. The breakfast was wonderful. Presented in a lovely basket with fruit, cereal, croissant, rusks, marmalade, butter and with a smile. It made our day.',
          de: 'Die Unterkunft war sehr sauber und warm, wir gingen im Januar. Die Lage ist großartig. Sehr ruhig. Das Frühstück war wunderbar. In einem schönen Korb präsentiert mit Obst, Müsli, Croissant, Zwieback, Marmelade, Butter und mit einem Lächeln. Es hat unseren Tag gemacht.'
        }
      },
      {
        reviewerName: 'Lisa',
        reviewText: 'The location, the warm welcome and kindness from Costandina and her husband.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'lisa_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 30 * 30 * 24 * 60 * 60 * 1000), // 30 months ago (Sep 2023)
        helpfulCount: 0,
        language: 'en',
        visible: true,
        featured: false,
        verified: true,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/lisa-1.jpg'
        ],
        translations: {
          el: 'The location, the warm welcome and kindness from Costandina and her husband.',
          en: 'The location, the warm welcome and kindness from Costandina and her husband.',
          de: 'Die Lage, der warme Empfang und die Freundlichkeit von Konstantina und ihrem Ehemann.'
        }
      },
      {
        reviewerName: 'Ivo',
        reviewText: 'Location is perfect, host is responsive and kind\nThe apartment is smaller than it seems on the pictures and the furniture is a bit outdated',
        rating: 8,
        source: 'booking' as const,
        sourceId: 'ivo_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 32 * 30 * 24 * 60 * 60 * 1000), // 32 months ago (Aug 2023)
        helpfulCount: 1,
        language: 'en',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'Location is perfect, host is responsive and kind\nThe apartment is smaller than it seems on the pictures and the furniture is a bit outdated',
          en: 'Location is perfect, host is responsive and kind\nThe apartment is smaller than it seems on the pictures and the furniture is a bit outdated',
          de: 'Lage ist perfekt, Gastgeber ist ansprechbar und freundlich\nDie Wohnung ist kleiner als sie auf den Bildern wirkt und die Möbel sind etwas veraltet'
        }
      },
      {
        reviewerName: 'Richard',
        reviewText: 'Super nice, excellent location, very quiet and even with breakfast.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'richard_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000), // 5 months ago (Oct 2025)
        helpfulCount: 0,
        language: 'de',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'Super nice, excellent location, very quiet and even with breakfast.',
          en: 'Super nice, excellent location, very quiet and even with breakfast.',
          de: 'Super nett, tolle Lage, sehr ruhig und sogar mit Frühstück'
        }
      },
      {
        reviewerName: 'Anne',
        reviewText: 'I was welcomed very warmly, even for just one day, and I had a wonderful view, friendly hosts and a wonderful room. The breakfast was also very good.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'anne_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6 months ago (Oct 2025)
        helpfulCount: 0,
        language: 'de',
        visible: true,
        featured: false,
        verified: true,
        translations: {
          el: 'I was welcomed very warmly, even for just one day, and I had a wonderful view, friendly hosts and a wonderful room. The breakfast was also very good.',
          en: 'I was welcomed very warmly, even for just one day, and I had a wonderful view, friendly hosts and a wonderful room. The breakfast was also very good.',
          de: 'Ich wurde sehr herzlich auch nur für 1 Tag aufgenommen, hatte eine sehr schöne Aussicht, freundliche Gastgeber und ein schönes Zimmer. Das Frühstück war ebenfalls sehr gut.'
        }
      },
      {
        reviewerName: 'Veronique',
        reviewText: 'De ontvangst was heel vriendelijk. Hotel Asterias ligt heel centraal, dichtbij 2 tavernes. Het appartement dat wij hadden bestond uit een keuken en 2 slaapkamers. Dus geen woonkamer. Het was allemaal erg oud. Electra in de keuken werkte niet, dus de tosties maar klaargemaakt in de slaapkamer. Het is veel te duur voor wat je krijgt.',
        rating: 6,
        source: 'booking' as const,
        sourceId: 'veronique_booking_1',
        reviewerType: 'COUPLE' as const,
        reviewDate: new Date(Date.now() - 1 * 30 * 24 * 60 * 60 * 1000), // 1 month ago (Jul 2025)
        helpfulCount: 0,
        language: 'nl',
        visible: true,
        featured: false,
        verified: true,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/veronique-1.jpg',
          'https://asterias-backend.onrender.com/review-photos/veronique-2.jpg'
        ],
        translations: {
          el: 'De ontvangst was heel vriendelijk. Hotel Asterias ligt heel centraal, dichtbij 2 tavernes. Het appartement dat wij hadden bestond uit een keuken en 2 slaapkamers. Dus geen woonkamer. Het was allemaal erg oud. Electra in de keuken werkte niet, dus de tosties maar klaargemaakt in de slaapkamer. Het is veel te duur voor wat je krijgt.',
          en: 'The reception was very friendly. Hotel Asterias is very central, close to 2 taverns. The apartment we had consisted of a kitchen and 2 bedrooms. So no living room. It was all very old. Electricity in the kitchen did not work, so the tosties were made in the bedroom. It is much too expensive for what you get.',
          de: 'Der Empfang war sehr freundlich. Hotel Asterias liegt sehr zentral, nahe 2 Tavernen. Die Wohnung, die wir hatten, bestand aus einer Küche und 2 Schlafzimmern. Also kein Wohnzimmer. Es war alles sehr alt. Strom in der Küche funktionierte nicht, also wurden die Toasts im Schlafzimmer gemacht. Es ist viel zu teuer für das, was man bekommt.',
          nl: 'De ontvangst was heel vriendelijk. Hotel Asterias ligt heel centraal, dichtbij 2 tavernes. Het appartement dat wij hadden bestond uit een keuken en 2 slaapkamers. Dus geen woonkamer. Het was allemaal erg oud. Electra in de keuken werkte niet, dus de tosties maar klaargemaakt in de slaapkamer. Het is veel te duur voor wat je krijgt.'
        }
      },
      {
        reviewerName: 'Milano',
        reviewText: 'Kostantina è sempre sorridente disponibile e gentile. Venite attrezzati nel villaggio non c\'è nessun negozio.',
        rating: 10,
        source: 'booking' as const,
        sourceId: 'milano_booking_1',
        reviewerType: 'GROUP' as const,
        reviewDate: new Date(Date.now() - 32 * 30 * 24 * 60 * 60 * 1000), // 32 months ago (Aug 2023)
        helpfulCount: 0,
        language: 'it',
        visible: true,
        featured: false,
        verified: true,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/milano-1.jpg',
          'https://asterias-backend.onrender.com/review-photos/milano-3.jpg'
        ],
        translations: {
          el: 'Kostantina è sempre sorridente disponibile e gentile. Venite attrezzati nel villaggio non c\'è nessun negozio.',
          en: 'Kostantina is always smiling, available and kind. Come equipped, there is no shop in the village.',
          de: 'Kostantina ist immer lächelnd, verfügbar und freundlich. Kommen Sie ausgestattet, es gibt keinen Laden im Dorf.',
          it: 'Kostantina è sempre sorridente disponibile e gentile. Venite attrezzati nel villaggio non c\'è nessun negozio.'
        }
      }
    ];

    // Clear existing Booking.com reviews
    await this.reviewModel.deleteMany({ source: 'booking' as any });
    const insertedReviews = await this.reviewModel.insertMany(bookingReviews);
    console.log(`Successfully seeded ${insertedReviews.length} Booking.com reviews`);
    
    // Calculate and log stats
    const stats = await this.reviewModel.aggregate([
      { $match: { source: 'booking' } },
      { $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: { $push: '$rating' }
      }}
    ]);
    
    if (stats.length > 0) {
      const stat = stats[0];
      console.log(`Booking.com Reviews - Average Rating: ${stat.averageRating.toFixed(1)}/10`);
      console.log(`Total Reviews: ${stat.totalReviews}`);
    }
    
    return insertedReviews;
  }

  async seedGoogleReviews() {
    console.log('Seeding Google reviews for Asterias...');

    const googleReviews = [
      {
        reviewerName: 'Konstantinos Blavakis',
        reviewText: 'Perfect place, very friendly service',
        rating: 5,
        source: 'google' as const,
        sourceId: 'konstantinos_blavakis_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Τέλειο μέρος, πολύ φιλική εξυπηρέτηση',
          en: 'Perfect place, very friendly service',
          de: 'Perfekter Ort, sehr freundlicher Service'
        }
      },
      {
        reviewerName: 'Lothar P',
        reviewText: 'It seems that disabled people are not welcome in this house. I have sent an eMail and an SMS with questions concerning needs of disabled people. No answer. 2 reminder -SMS 24h later also have been ignored. Very poor service ! Shame on you !',
        rating: 1,
        source: 'google' as const,
        sourceId: 'lothar_p_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000), // 5 months ago
        helpfulCount: 0,
        language: 'en',
        visible: true,
        featured: false,
        verified: false,
        responseText: 'We have not received any message from you by email or sms. Are you sure you have written the review for the correct hotel?',
        responseDate: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000),
        translations: {
          el: 'Φαίνεται ότι τα άτομα με αναπηρίες δεν είναι ευπρόσδεκτα σε αυτό το σπίτι. Έχω στείλει email και SMS με ερωτήσεις σχετικά με τις ανάγκες των ατόμων με αναπηρίες. Καμία απάντηση. 2 υπενθυμίσεις -SMS 24 ώρες αργότερα επίσης αγνοήθηκαν. Πολύ κακή εξυπηρέτηση! Να ντρέπεστε!',
          en: 'It seems that disabled people are not welcome in this house. I have sent an eMail and an SMS with questions concerning needs of disabled people. No answer. 2 reminder -SMS 24h later also have been ignored. Very poor service ! Shame on you !',
          de: 'Es scheint, dass behinderte Menschen in diesem Haus nicht willkommen sind. Ich habe eine E-Mail und eine SMS mit Fragen zu den Bedürfnissen von behinderten Menschen gesendet. Keine Antwort. 2 Erinnerungs-SMS 24h später wurden ebenfalls ignoriert. Sehr schlechter Service! Schämen Sie sich!'
        }
      },
      {
        reviewerName: 'Adi E.',
        reviewText: 'The hospitality was tremendous, the rooms were spotless, the hosts were extremely courteous, the breakfast was delicious and full. I recommend it unconditionally to everyone!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'adi_e_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Η φιλοξενία ήταν τεράστια, τα δωμάτια ήταν άψογα, οι οικοδεσπότες ήταν εξαιρετικά ευγενικοί, το πρωινό ήταν νόστιμο και πλήρες. Το προτείνω ανεπιφύλακτα σε όλους!',
          en: 'The hospitality was tremendous, the rooms were spotless, the hosts were extremely courteous, the breakfast was delicious and full. I recommend it unconditionally to everyone!',
          de: 'Die Gastfreundschaft war gewaltig, die Zimmer waren makellos, die Gastgeber waren äußerst höflich, das Frühstück war köstlich und reichlich. Ich empfehle es bedingungslos an alle!'
        }
      },
      {
        reviewerName: 'Mariananna Batika',
        reviewText: 'Wonderful people, wonderful and most importantly perfectly clean space, next to the shops and the sea, really if you want to escape from everyday life and relax they provide it to the fullest! The location is ideal, the rooms have everything you need, the hospitality is family and warm. We will definitely come again!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'mariananna_batika_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 3,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Υπέροχοι άνθρωποι, υπέροχο και κυρίως τέλεια καθαρός χώρος, δίπλα από τα μαγαζιά και τη θάλασσα, πραγματικά αν θέλεις να ξεφύγεις από την καθημερινότητα και χαλάρωση σας το παρέχουν στο μέγιστο! Η τοποθεσία είναι ιδανική, τα δωμάτια έχουν όλα αυτά που χρειάζεστε, η φιλοξενία είναι οικογενειακή και ζεστή. Σίγουρα θα έρθουμε πάλι!',
          en: 'Wonderful people, wonderful and most importantly perfectly clean space, next to the shops and the sea, really if you want to escape from everyday life and relax they provide it to the fullest! The location is ideal, the rooms have everything you need, the hospitality is family and warm. We will definitely come again!',
          de: 'Wundervolle Menschen, wundervoll und vor allem perfekt sauberer Raum, neben den Geschäften und dem Meer, wirklich wenn Sie dem Alltag entfliehen und sich entspannen wollen, bieten sie es auf das Vollste! Die Lage ist ideal, die Zimmer haben alles, was Sie brauchen, die Gastfreundschaft ist familiär und warm. Wir werden auf jeden Fall wiederkommen!'
        },
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/batika-1.mp4',
          'https://asterias-backend.onrender.com/review-photos/batika-2.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-3.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-4.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-5.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-6.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-7.webp',
          'https://asterias-backend.onrender.com/review-photos/batika-8.webp'
        ]
      },
      {
        reviewerName: 'Akis Georgakas',
        reviewText: 'The hospitality from the whole family was excellent. The room for four people was wonderful as was the breakfast. We will come again.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'akis_georgakas_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000), // 9 months ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Η φιλοξενία από όλη την οικογένεια ήταν εξαιρετική. Το δωμάτιο για τέσσερα άτομα ήταν υπέροχο όπως και το πρωινό. Θα έρθουμε ξανά.',
          en: 'The hospitality from the whole family was excellent. The room for four people was wonderful as was the breakfast. We will come again.',
          de: 'Die Gastfreundschaft der ganzen Familie war ausgezeichnet. Das Zimmer für vier Personen war wunderbar, ebenso wie das Frühstück. Wir werden wiederkommen.'
        }
      },
      {
        reviewerName: 'Andromachi Stathatou',
        reviewText: 'Unique hospitality, beautiful space in the green and blue for rest, peace, relaxation and rest!!! The view is wonderful towards the sea and the lake! From Asterias one leaves absolutely satisfied...and will surely try to visit him again! We loved the hotel Asterias and its very kind people ... Thank you very much!!!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'andromachi_stathatou_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Μοναδική φιλοξενία, πανέμορφος χώρος στο πράσινο και το γαλάζιο για ξεκούραση, ηρεμία, χαλάρωση και ανάπαυση!!! Η θέα είναι υπέροχη προς τη θάλασσα και τη λίμνη! Από τα Αστέρια φεύγεις απόλυτα ικανοποιημένος...και σίγουρα θα προσπαθήσεις να τον επισκεφτείς ξανά! Αγαπήσαμε το ξενοδοχείο Αστέρια και τα πολύ ευγενικά του άτομα ... Σας ευχαριστούμε πολύ!!!',
          en: 'Unique hospitality, beautiful space in the green and blue for rest, peace, relaxation and rest!!! The view is wonderful towards the sea and the lake! From Asterias one leaves absolutely satisfied...and will surely try to visit him again! We loved the hotel Asterias and its very kind people ... Thank you very much!!!',
          de: 'Einzigartige Gastfreundschaft, schöner Raum im Grünen und Blauen zur Ruhe, Frieden, Entspannung und Erholung!!! Die Aussicht ist wunderschön zum Meer und See! Von Asterias verlässt man absolut zufrieden...und wird sicher versuchen, ihn wieder zu besuchen! Wir liebten das Hotel Asterias und seine sehr netten Menschen ... Vielen Dank!!!'
        }
      },
      {
        reviewerName: 'Apo Chris',
        reviewText: 'Excellent place to stay! Very beautiful and functional rooms, clean and economical with very easy parking. The owner is a wonderful and helpful person. It is located in a quiet place for anyone looking for peace. The sea is very close, as well as taverns and sights of Koronisia. Highly recommended.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'apo_chris_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false
      },
      {
        reviewerName: 'Paris Kala',
        reviewText: 'A really great place for family vacation. Everything was within a 2 minutes walk. Mr Bill and Mrs Dina are keeping the rooms super clean and tidy. Very helpful all the time. Rooms are a little bit small but they can fit a 4 members family. I keep the best for last, prices are fantastic. You should give it a try',
        rating: 5,
        source: 'google' as const,
        sourceId: 'paris_kala_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 3 years ago
        helpfulCount: 0,
        language: 'en',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Πραγματικά εξαιρετικό μέρος για οικογενειακές διακοπές. Όλα ήταν σε απόσταση 2 λεπτών με τα πόδια. Ο κύριος Μπιλ και η κυρία Ντίνα διατηρούν τα δωμάτια υπερκαθαρά και τακτοποιημένα. Πολύ χρήσιμοι όλη την ώρα. Τα δωμάτια είναι λίγο μικρά αλλά μπορούν να χωρέσουν μια οικογένεια 4 ατόμων. Αφήνω το καλύτερο για το τέλος, οι τιμές είναι φανταστικές. Πρέπει να το δοκιμάσετε',
          en: 'A really great place for family vacation. Everything was within a 2 minutes walk. Mr Bill and Mrs Dina are keeping the rooms super clean and tidy. Very helpful all the time. Rooms are a little bit small but they can fit a 4 members family. I keep the best for last, prices are fantastic. You should give it a try',
          de: 'Ein wirklich toller Ort für den Familienurlaub. Alles war innerhalb von 2 Minuten zu Fuß erreichbar. Herr Bill und Frau Dina halten die Zimmer super sauber und ordentlich. Sehr hilfsbereit die ganze Zeit. Die Zimmer sind etwas klein, aber sie können eine 4-köpfige Familie unterbringen. Ich lasse das Beste für den Schluss, die Preise sind fantastisch. Sie sollten es versuchen'
        }
      },
      {
        reviewerName: 'Elena VelonAki',
        reviewText: 'Favorite place for family holidays! Spacious rooms with friendly hosts next to the sea and beautiful shops for food and coffee.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'elena_velonaki_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Αγαπημένο μέρος για οικογενειακές διακοπές! Ευρύχωρα δωμάτια με φιλικούς οικοδεσπότες δίπλα στη θάλασσα και όμορφα μαγαζιά για φαγητό και καφέ.',
          en: 'Favorite place for family holidays! Spacious rooms with friendly hosts next to the sea and beautiful shops for food and coffee.',
          de: 'Lieblingsort für Familienurlaub! Geräumige Zimmer mit freundlichen Gastgebern neben dem Meer und schönen Geschäften für Essen und Kaffee.'
        }
      },
      {
        reviewerName: 'Areti Hatzopoulou',
        reviewText: 'Very well-kept apartments, spotlessly clean, with all the comforts, where at every point you see the interest of the owners for their work. The most hospitable and kind owners of rentals I have ever met! We will definitely come again!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'areti_hatzopoulou_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Πολύ καλά συντηρημένα διαμερίσματα, άψογα καθαρά, με όλες τις ανέσεις, όπου σε κάθε σημείο βλέπεις το ενδιαφέρον των ιδιοκτητών για τη δουλειά τους. Οι πιο φιλόξενοι και ευγενικοί ιδιοκτήτες ενοικιαζόμενων που έχω συναντήσει ποτέ! Σίγουρα θα έρθουμε ξανά!',
          en: 'Very well-kept apartments, spotlessly clean, with all the comforts, where at every point you see the interest of the owners for their work. The most hospitable and kind owners of rentals I have ever met! We will definitely come again!',
          de: 'Sehr gut gepflegte Wohnungen, makellos sauber, mit allem Komfort, wo man an jedem Punkt das Interesse der Besitzer für ihre Arbeit sieht. Die gastfreundlichsten und freundlichsten Vermieter, die ich je getroffen habe! Wir werden auf jeden Fall wiederkommen!'
        }
      },
      {
        reviewerName: 'asfalies 2014',
        reviewText: 'clean rooms next to the sea. equipped kitchen is high and has a light breeze which is magical.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'asfalies_2014_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        photoUrls: ['https://asterias-backend.onrender.com/review-photos/asfalies-1.webp'],
        translations: {
          el: 'καθαρά δωμάτια δίπλα στη θάλασσα. εξοπλισμένη κουζίνα είναι ψηλά και έχει ελαφριά αύρα που είναι μαγική.',
          en: 'clean rooms next to the sea. equipped kitchen is high and has a light breeze which is magical.',
          de: 'saubere Zimmer neben dem Meer. ausgestattete Küche ist hoch und hat eine leichte Brise, die magisch ist.'
        }
      },
      {
        reviewerName: 'Despoina Voulgari',
        reviewText: 'It is very close to the beach has very good apartments with all the comforts you want and very helpful and kind owners. We recommend it to you unconditionally.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'despoina_voulgari_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Είναι πολύ κοντά στην παραλία έχει πολύ καλά διαμερίσματα με όλες τις ανέσεις που θέλετε και πολύ χρήσιμους και ευγενικούς ιδιοκτήτες. Το προτείνουμε ανεπιφύλακτα.',
          en: 'It is very close to the beach has very good apartments with all the comforts you want and very helpful and kind owners. We recommend it to you unconditionally.',
          de: 'Es ist sehr nah am Strand hat sehr gute Wohnungen mit allem Komfort, den Sie wollen, und sehr hilfsbereite und freundliche Besitzer. Wir empfehlen es Ihnen bedingungslos.'
        }
      },
      {
        reviewerName: 'Maria Giannitsi',
        reviewText: 'Very very nice rooms clean and comfortable. The owner was extremely kind and helpful. We had a very beautiful time.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'maria_giannitsi_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 48 * 30 * 24 * 60 * 60 * 1000), // 4 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Πολύ πολύ όμορφα δωμάτια καθαρά και άνετα. Η ιδιοκτήτρια ήταν εξαιρετικά ευγενική και χρήσιμη. Πέρασαμε πολύ όμορφη ώρα.',
          en: 'Very very nice rooms clean and comfortable. The owner was extremely kind and helpful. We had a very beautiful time.',
          de: 'Sehr sehr schöne Zimmer sauber und bequem. Die Besitzerin war äußerst nett und hilfsbereit. Wir hatten eine sehr schöne Zeit.'
        }
      },
      {
        reviewerName: 'De Lazzero Bogdan',
        reviewText: 'Great value for money, if you are not looking for luxurious places. Accommodation is decent (more like 80\'s), clean. Beach and wetlands, sunrise, sunset, all wow!',
        rating: 4,
        source: 'google' as const,
        sourceId: 'de_lazzero_bogdan_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 0,
        language: 'en',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Σπουδαία σχέση ποιότητας-τιμής, αν δεν ψάχνετε για πολυτελή μέρη. Η διαμονή είναι αξιοπρεπής (πιο σαν 80\'s), καθαρά. Παραλία και υδρόβια περιοχή, ανατολή, δύση, όλα wow!',
          en: 'Great value for money, if you are not looking for luxurious places. Accommodation is decent (more like 80\'s), clean. Beach and wetlands, sunrise, sunset, all wow!',
          de: 'Großartiges Preis-Leistungs-Verhältnis, wenn Sie nicht nach luxuriösen Orten suchen. Unterkunft ist anständig (mehr wie 80er), sauber. Strand und Feuchtgebiete, Sonnenaufgang, Sonnenuntergang, alles wow!'
        }
      },
      {
        reviewerName: 'Dimitrios Fokianos',
        reviewText: 'Clean...kind hosts...Very good accommodation price!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'dimitrios_fokianos_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Καθαρά...φιλικοί οικοδεσπότες...Πολύ καλή τιμή διαμονής!',
          en: 'Clean...kind hosts...Very good accommodation price!',
          de: 'Sauber...freundliche Gastgeber...Sehr guter Übernachtungspreis!'
        }
      },
      {
        reviewerName: 'KATERINA ZERVA',
        reviewText: 'Well-kept, clean, friendly... very good!!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'katerina_zerva_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Καλά συντηρημένο, καθαρό, φιλικό... πολύ καλό!!',
          en: 'Well-kept, clean, friendly... very good!!',
          de: 'Gut gepflegt, sauber, freundlich... sehr gut!!'
        }
      },
      {
        reviewerName: 'Kostas Tachas',
        reviewText: 'Perfect place!! Very hospitable people!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'kostas_tachas_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 3 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Τέλειο μέρος!! Πολύ φιλόξενοι άνθρωποι!',
          en: 'Perfect place!! Very hospitable people!',
          de: 'Perfekter Ort!! Sehr gastfreundliche Menschen!'
        }
      },
      {
        reviewerName: 'Manolis Markopoulos',
        reviewText: 'Perfect place, very friendly service',
        rating: 5,
        source: 'google' as const,
        sourceId: 'manolis_markopoulos_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 3 years ago
        helpfulCount: 1,
        language: 'el',
        visible: true,
        featured: true,
        verified: false,
        translations: {
          el: 'Τέλειο μέρος, πολύ φιλική εξυπηρέτηση',
          en: 'Perfect place, very friendly service',
          de: 'Perfekter Ort, sehr freundlicher Service'
        }
      },
      {
        reviewerName: 'Rotuf GR',
        reviewText: 'Very good has everything you need!!!!',
        rating: 5,
        source: 'google' as const,
        sourceId: 'rotuf_gr_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 84 * 30 * 24 * 60 * 60 * 1000), // 7 years ago
        helpfulCount: 2,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Πολύ καλό έχει όλα όσα χρειάζεστε!!!!',
          en: 'Very good has everything you need!!!!',
          de: 'Sehr gut hat alles was Sie brauchen!!!!'
        }
      },
      {
        reviewerName: 'Nektar Psaradelli',
        reviewText: 'Amazing',
        rating: 5,
        source: 'google' as const,
        sourceId: 'nektar_psaradelli_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Φανταστικό',
          en: 'Amazing',
          de: 'Erstaunlich'
        }
      },
      {
        reviewerName: 'Ne Ro',
        reviewText: 'Es ist schon etwas in die Jahre gekommen und hier und da fällt auch schon mal was ab oder funktioniert nicht. Doch grundsätzlich ist es sauber und alle 4 Tage gibt es neue Handtücher und Bettwäsche. Die beiden Damen die uns versorgen sind super freundlich. Eine spricht auch englisch die andere nur griechisch. Der Frühstücksservice (zwischen 09:00 und 09:30) ist abwechslungsreich und doch gewöhnungsbedürftig. Zwieback gibt es jeden Tag (pro Person 2) auch Milch und Saft. Dann gibt es mal Pfannkuchen oder Käse-Pita, Rührei, Toastscheiben, Käse und Wurst oder Kornflakes. Wir würden es wieder buchen und uns selbst versorgen.',
        rating: 4,
        source: 'google' as const,
        sourceId: 'ne_ro_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000), // 5 months ago
        helpfulCount: 1,
        language: 'de',
        visible: true,
        featured: false,
        verified: false,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/ne-1.webp',
          'https://asterias-backend.onrender.com/review-photos/ne-2.webp',
          'https://asterias-backend.onrender.com/review-photos/ne-3.webp',
          'https://asterias-backend.onrender.com/review-photos/ne-4.webp'
        ],
        translations: {
          el: 'Είναι κάπως παλιό και εδώ και εκεί πέφτει κάτι ή δεν λειτουργεί. Αλλά βασικά είναι καθαρό και κάθε 4 μέρες υπάρχουν νέες πετσέτες και σεντόνια. Οι δύο κυρίες που μας φροντίζουν είναι super φιλικές. Μια μιλάει και αγγλικά η άλλη μόνο ελληνικά. Η υπηρεσία πρωινού (μεταξύ 09:00 και 09:30) είναι ποικιλόμορφη αλλά απαιτεί προσαρμογή. Κράκερ υπάρχει κάθε μέρα (2 ανά άτομο) επίσης γάλα και χυμός. Έπειτα υπάρχουν τηγανίτες ή τυρόπιτα, scrambled eggs, φέτες τοστ, τυρί και λουκάνικο ή κορν φλέικς. Θα το ξανά κλείναμε και θα φροντίζαμε μόνοι μας.',
          en: 'It is a bit old and here and there things fall off or don\'t work. But basically it is clean and every 4 days there are new towels and bed linen. The two ladies who take care of us are super friendly. One speaks English the other only Greek. The breakfast service (between 09:00 and 09:30) is varied but needs getting used to. There are crackers every day (2 per person) also milk and juice. Then there are pancakes or cheese-pita, scrambled eggs, toast slices, cheese and sausage or cornflakes. We would book it again and take care of ourselves.',
          de: 'Es ist schon etwas in die Jahre gekommen und hier und da fällt auch schon mal was ab oder funktioniert nicht. Doch grundsätzlich ist es sauber und alle 4 Tage gibt es neue Handtücher und Bettwäsche. Die beiden Damen die uns versorgen sind super freundlich. Eine spricht auch englisch die andere nur griechisch. Der Frühstücksservice (zwischen 09:00 und 09:30) ist abwechslungsreich und doch gewöhnungsbedürftig. Zwieback gibt es jeden Tag (pro Person 2) auch Milch und Saft. Dann gibt es mal Pfannkuchen oder Käse-Pita, Rührei, Toastscheiben, Käse und Wurst oder Kornflakes. Wir würden es wieder buchen und uns selbst versorgen.'
        }
      },
      {
        reviewerName: 'Brigitte Seelen',
        reviewText: 'Een heerlijk verblijf in een brandschoon appartement bijna direct aan zee. Zeer correcte en vriendelijke gastheer. Het ontbijt gebracht in een goed gevulde mand was ruim voldoende voor twee personen.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'brigitte_seelen_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        helpfulCount: 0,
        language: 'nl',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Ευχάριστη διαμονή σε ένα άψογα καθαρό διαμέρισμα σχεδόν ακριβώς δίπλα στη θάλασσα. Πολύ σωστός και φιλικός οικοδεσπότης. Το πρωινό που παραδόθηκε σε ένα καλά γεμάτο καλάθι ήταν περισσότερο από αρκετό για δύο άτομα.',
          en: 'A wonderful stay in a spotlessly clean apartment almost right by the sea. Very correct and friendly host. The breakfast delivered in a well-filled basket was more than sufficient for two people.',
          de: 'Ein herrlicher Aufenthalt in einem brandsauberen Apartment fast direkt am Meer. Sehr korrekter und freundlicher Gastgeber. Das Frühstück in einem gut gefüllten Korb geliefert war mehr als ausreichend für zwei Personen.',
          nl: 'Een heerlijk verblijf in een brandschoon appartement bijna direct aan zee. Zeer correcte en vriendelijke gastheer. Het ontbijt gebracht in een goed gevulde mand was ruim voldoende voor twee personen.'
        }
      },
      {
        reviewerName: 'Leonie Hödl',
        reviewText: 'Hallo, wir würden gerne ein Zimmer buchen und finden keine Telefonnummer oder Internetseite. Grüße Leonie',
        rating: 3,
        source: 'google' as const,
        sourceId: 'leonie_hodl_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        helpfulCount: 0,
        language: 'de',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Γεια σας, θα θέλαμε να κλείσουμε ένα δωμάτιο και δεν βρίσκουμε τηλέφωνο ή ιστοσελίδα. Χαιρετισμούς Λεονί',
          en: 'Hello, we would like to book a room and cannot find a phone number or website. Regards Leonie',
          de: 'Hallo, wir würden gerne ein Zimmer buchen und finden keine Telefonnummer oder Internetseite. Grüße Leonie'
        }
      },
      {
        reviewerName: 'yasmina habib',
        reviewText: 'Hôte réactif et sympa Il y a tout le nécessaire pour un court séjour Sur ce beau petit bout de terre (koronisia) relaxant et reposant',
        rating: 5,
        source: 'google' as const,
        sourceId: 'yasmina_habib_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 0,
        language: 'fr',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Γρήγορος και φιλικός οικοδεσπότης Υπάρχει όλα τα απαραίτητα για μια σύντομη διαμονή Σε αυτό το όμορφο μικρό κομμάτι γης (κορώνισια) χαλαρωτικό και ξεκούραστο',
          en: 'Responsive and friendly host There is everything necessary for a short stay On this beautiful little piece of land (koronisia) relaxing and restful',
          de: 'Reaktionsfreudiger und sympathischer Gastgeber Es gibt alles Notwendige für einen kurzen Aufenthalt Auf diesem schönen kleinen Stück Land (Koronisia) entspannend und erholsam',
          fr: 'Hôte réactif et sympa Il y a tout le nécessaire pour un court séjour Sur ce beau petit bout de terre (koronisia) relaxant et reposant'
        }
      },
      {
        reviewerName: 'Kr. Uzuko',
        reviewText: 'Nice place in the center of the village, close to all interesting places.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'kr_uzuko_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 1,
        language: 'bg',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Ωραίο μέρος στο κέντρο του χωριού, κοντά σε όλα τα ενδιαφέροντα μέρη.',
          en: 'Nice place in the center of the village, close to all interesting places.',
          de: 'Schöner Ort im Zentrum des Dorfes, nahe allen interessanten Plätzen.'
        }
      },
      {
        reviewerName: 'Bibi Fi',
        reviewText: 'Geweldige plek in het midden van het prachtige Koronisia.',
        rating: 5,
        source: 'google' as const,
        sourceId: 'bibi_fi_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 0,
        language: 'nl',
        visible: true,
        featured: false,
        verified: false,
        photoUrls: [
          'https://asterias-backend.onrender.com/review-photos/bibi-1.webp',
          'https://asterias-backend.onrender.com/review-photos/bibi-2.webp',
          'https://asterias-backend.onrender.com/review-photos/bibi-3.webp',
          'https://asterias-backend.onrender.com/review-photos/bibi-4.webp'
        ],
        translations: {
          el: 'Φανταστικό μέρος στη μέση του υπέροχου Κορωνησίου.',
          en: 'Great place in the middle of beautiful Koronisia.',
          de: 'Großartiger Ort in der Mitte des wunderschönen Koronisia.',
          nl: 'Geweldige plek in het midden van het prachtige Koronisia.'
        }
      },
      {
        reviewerName: 'Steve Balatsonis',
        reviewText: 'Quiet, Suitable for children',
        rating: 5,
        source: 'google' as const,
        sourceId: 'steve_balatsonis_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000), // 3 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Ήσυχο, Κατάλληλο για παιδιά',
          en: 'Quiet, Suitable for children',
          de: 'Ruhig, Geeignet für Kinder'
        }
      },
      {
        reviewerName: 'Vanessa Nom',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'vanessa_nom_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6 months ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Εξαιρετικό!',
          en: 'Excellent!',
          de: 'Ausgezeichnet!'
        }
      },
      {
        reviewerName: 'Lefteris Mamasiulas',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'lefteris_mamasiulas_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000), // 7 months ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Τέλειο!',
          en: 'Perfect!',
          de: 'Perfekt!'
        }
      },
      {
        reviewerName: 'Anatoli Papnikou',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'anatoli_papnikou_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000), // 9 months ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Σούπερ!',
          en: 'Super!',
          de: 'Super!'
        }
      },
      {
        reviewerName: 'maria niko',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'maria_niko_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Όμορφο!',
          en: 'Beautiful!',
          de: 'Wunderschön!'
        }
      },
      {
        reviewerName: 'Antwnis Thimiop',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'antwnis_thimiop_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Φανταστικό!',
          en: 'Fantastic!',
          de: 'Fantastisch!'
        }
      },
      {
        reviewerName: 'Vangelis',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'vangelis_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000), // 1 year ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Εξαιρετικό!',
          en: 'Excellent!',
          de: 'Hervorragend!'
        }
      },
      {
        reviewerName: 'Philip Pappas',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'philip_pappas_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000), // 2 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Τέλειο!',
          en: 'Perfect!',
          de: 'Perfekt!'
        }
      },
      {
        reviewerName: 'Sky AudioVisual',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'sky_audiovisual_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 48 * 30 * 24 * 60 * 60 * 1000), // 4 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Σούπερ!',
          en: 'Super!',
          de: 'Super!'
        }
      },
      {
        reviewerName: 'xaris tsetsikas',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'xaris_tsetsikas_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 48 * 30 * 24 * 60 * 60 * 1000), // 4 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Όμορφο!',
          en: 'Beautiful!',
          de: 'Wunderschön!'
        }
      },
      {
        reviewerName: 'efi',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'efi_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 48 * 30 * 24 * 60 * 60 * 1000), // 4 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Όμορφο!',
          en: 'Beautiful!',
          de: 'Wunderschön!'
        }
      },
      {
        reviewerName: 'Ilias Kotserinis',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'ilias_kotserinis_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 48 * 30 * 24 * 60 * 60 * 1000), // 4 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Τέλειο!',
          en: 'Perfect!',
          de: 'Perfekt!'
        }
      },
      {
        reviewerName: 'Spyros Ntavakos',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'spyros_ntavakos_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Εξαιρετικό!',
          en: 'Excellent!',
          de: 'Ausgezeichnet!'
        }
      },
      {
        reviewerName: 'Chris Kofidis',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'chris_kofidis_1',
        reviewerType: 'USER' as const,
        reviewDate: new Date(Date.now() - 72 * 30 * 24 * 60 * 60 * 1000), // 6 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Σούπερ!',
          en: 'Super!',
          de: 'Super!'
        }
      },
      {
        reviewerName: 'Michalis Psarris',
        reviewText: '',
        rating: 5,
        source: 'google' as const,
        sourceId: 'michalis_psarris_1',
        reviewerType: 'LOCAL_GUIDE' as const,
        reviewDate: new Date(Date.now() - 84 * 30 * 24 * 60 * 60 * 1000), // 7 years ago
        helpfulCount: 0,
        language: 'el',
        visible: true,
        featured: false,
        verified: false,
        translations: {
          el: 'Φανταστικό!',
          en: 'Fantastic!',
          de: 'Fantastisch!'
        }
      }
    ];

    // Clear existing Google reviews
    await this.reviewModel.deleteMany({ source: 'google' });

    // Insert new reviews
    const insertedReviews = await this.reviewModel.insertMany(googleReviews);

    console.log(`Successfully seeded ${insertedReviews.length} Google reviews`);
    
    // Calculate and log statistics
    const stats = await this.reviewModel.aggregate([
      { $match: { source: 'google' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: { $push: '$rating' }
        }
      }
    ]);

    if (stats.length > 0) {
      const distribution = [0, 0, 0, 0, 0];
      stats[0].ratingDistribution.forEach((rating: number) => {
        distribution[rating - 1]++;
      });

      console.log('Review Statistics:');
      console.log(`Average Rating: ${Math.round(stats[0].averageRating * 10) / 10}`);
      console.log(`Total Reviews: ${stats[0].totalReviews}`);
      console.log(`Rating Distribution: 5 stars (${distribution[4]}), 4 stars (${distribution[3]}), 3 stars (${distribution[2]}), 2 stars (${distribution[1]}), 1 star (${distribution[0]})`);
    }

    return insertedReviews;
  }

  async clearAllReviews(): Promise<mongo.DeleteResult> {
    console.log('Clearing all reviews...');
    const result = await this.reviewModel.deleteMany({});
    console.log(`Deleted ${result.deletedCount} reviews`);
    return result;
  }
}
