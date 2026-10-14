// Offline engine wording in English, Hindi and Marathi. Every fact still comes from a tool result;
// these are only the sentences around it. Hindi/Marathi should be reviewed by a native speaker.
import type { Locale, QuickReply } from "./types";

export interface OfflineStrings {
  days: Record<string, string>;
  join: (items: string[]) => string;
  askPhone: string;
  badPhone: string;
  callbackReady: string;
  tripTo: (place: string) => string;
  builtIn: string[];
  actuals: string[];
  promise: string;
  fareExplain: (built: string, actuals: string) => string;
  fareAskWhere: string;
  fareQuote: (place: string, total: string) => string;
  fareNotPublished: (place: string, distancePending: boolean) => string;
  noRoute: (place: string) => string;
  distance: (km: unknown) => string;
  distancePending: string;
  driveTime: (hours: number) => string;
  drivePending: string;
  details: (page: string) => string;
  closedEvery: (place: string, days: string) => string;
  noClosingDay: (place: string) => string;
  closingUnconfirmed: (place: string, conflict: boolean) => string;
  hours: (open: string, close: string) => string;
  hoursPending: string;
  unesco: string;
  more: (page: string) => string;
  greeting: string;
  fallback: string;
  languages: string;
  cityName: string;
  menu: QuickReply[];
  fareTo: (place: string) => QuickReply;
  howFar: (place: string) => QuickReply;
  callMe: (place?: string) => QuickReply;
  confirmLabel: string;
  cancelLabel: string;
  sent: string;
  expired: string;
  cancelled: string;
  sorry: string;
}

const en: OfflineStrings = {
  days: { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" },
  join: (xs) => xs.join(" and "),
  askPhone: "Happy to arrange a call back from our team. Please send your name and 10-digit mobile number, for example: “Call me on 98xxxxxxxx, my name is Ravi”.",
  badPhone: "That number doesn't look like a 10-digit Indian mobile number. Could you send it again?",
  callbackReady: "I've prepared a call-back request. Please check the card below and press Confirm to send it. Nothing is saved until you do.",
  tripTo: (p) => `Trip to ${p}`,
  builtIn: ["distance driven (whole km)", "daily minimum distance top-up", "driver allowance per day", "night halt when the trip spans the night", "GST as its own line"],
  actuals: ["tolls", "parking", "state entry tax outside Maharashtra"],
  promise: "The bill is checked against the saved quote and only changes if the trip itself changes.",
  fareExplain: (b, a) => `Every quote is itemised. Built into the price: ${b}. Paid at actual cost: ${a}.`,
  fareAskWhere: "Tell me where you're going and I'll check the fare.",
  fareQuote: (p, t) => `A one-way sedan from Chhatrapati Sambhajinagar to ${p} comes to ${t} including the listed items. Tolls and parking are paid at actual cost.`,
  fareNotPublished: (p, d) => `Fares to ${p} aren't published yet${d ? " (the road distance is still being verified)" : ""}. I can ask our team to call you with a quote.`,
  noRoute: (p) => `I don't have a route to ${p} yet.`,
  distance: (km) => `The road distance is ${km} km.`,
  distancePending: "The road distance is still being verified.",
  driveTime: (h) => `Typical drive time is about ${h} hours.`,
  drivePending: "Drive time is still being verified.",
  details: (p) => `Details: ${p}`,
  closedEvery: (p, d) => `${p} is closed every ${d}.`,
  noClosingDay: (p) => `${p} has no weekly closing day.`,
  closingUnconfirmed: (p, c) =>
    `The weekly closing day for ${p} isn't confirmed: ${c ? "published sources disagree, so it is being confirmed with the authority" : "it has not been confirmed with an official source yet"}. Please check before you travel.`,
  hours: (o, c) => `Opening hours: ${o}–${c}.`,
  hoursPending: "Opening hours are still being verified.",
  unesco: "It is a UNESCO World Heritage Site.",
  more: (p) => `More: ${p}`,
  greeting: "Namaste! I can tell you about destinations around Chhatrapati Sambhajinagar, how our fares work, and arrange a call back from our team.",
  fallback: "I'm in basic mode and didn't catch that. Try asking about a place (like Ellora or Shirdi), fares, or a call back.",
  languages: "The site and assistant work in English, Hindi and Marathi.",
  cityName: "Our trips start from Chhatrapati Sambhajinagar, Maharashtra.",
  menu: [
    { label: "Ellora closing day", message: "Is Ellora closed on Tuesday?" },
    { label: "Fare to Shirdi", message: "What is the fare to Shirdi?" },
    { label: "How fares work", message: "How do fares work?" },
    { label: "Call me back", message: "Please call me back" },
  ],
  fareTo: (p) => ({ label: `Fare to ${p}`, message: `What is the fare to ${p}?` }),
  howFar: (p) => ({ label: "How far is it?", message: `How far is ${p}?` }),
  callMe: (p) => ({ label: "Call me back", message: p ? `Please call me back about a trip to ${p}` : "Please call me back" }),
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  sent: "Sent. Our team will call you back.",
  expired: "That request has expired or was already handled. Ask again and I'll prepare a new one.",
  cancelled: "Cancelled. Nothing was saved.",
  sorry: "Sorry, I couldn't answer just now.",
};

const hi: OfflineStrings = {
  days: { mon: "सोमवार", tue: "मंगलवार", wed: "बुधवार", thu: "गुरुवार", fri: "शुक्रवार", sat: "शनिवार", sun: "रविवार" },
  join: (xs) => xs.join(" और "),
  askPhone: "हमारी टीम से कॉल-बैक की व्यवस्था कर देता हूँ। कृपया अपना नाम और 10 अंकों का मोबाइल नंबर भेजें, जैसे: “98xxxxxxxx पर कॉल करें, मेरा नाम रवि है”।",
  badPhone: "यह 10 अंकों का भारतीय मोबाइल नंबर नहीं लगता। कृपया फिर से भेजें।",
  callbackReady: "मैंने कॉल-बैक अनुरोध तैयार कर दिया है। नीचे दिया कार्ड देखें और भेजने के लिए \"पुष्टि करें\" दबाएँ। तब तक कुछ भी सहेजा नहीं जाएगा।",
  tripTo: (p) => `${p} की यात्रा`,
  builtIn: ["तय की गई दूरी (पूरे किमी में)", "दैनिक न्यूनतम दूरी की पूर्ति", "प्रतिदिन ड्राइवर भत्ता", "रात भर की यात्रा में रात्रि ठहराव", "अलग पंक्ति में जीएसटी"],
  actuals: ["टोल", "पार्किंग", "महाराष्ट्र के बाहर राज्य प्रवेश कर"],
  promise: "बिल का मिलान सहेजे गए कोटेशन से किया जाता है और यह तभी बदलता है जब यात्रा ही बदले।",
  fareExplain: (b, a) => `हर कोटेशन में पूरा ब्योरा होता है। किराए में शामिल: ${b}। वास्तविक खर्च के अनुसार: ${a}।`,
  fareAskWhere: "बताइए कहाँ जाना है, मैं किराया देख लेता हूँ।",
  fareQuote: (p, t) => `छत्रपति संभाजीनगर से ${p} तक एकतरफ़ा सेडान का किराया, बताई गई चीज़ों सहित, ${t} है। टोल और पार्किंग वास्तविक खर्च के अनुसार।`,
  fareNotPublished: (p, d) => `${p} के लिए किराया अभी प्रकाशित नहीं हुआ है${d ? " (सड़क मार्ग की दूरी का सत्यापन जारी है)" : ""}। मैं हमारी टीम से आपको कोटेशन के लिए कॉल करवा सकता हूँ।`,
  noRoute: (p) => `${p} तक का मार्ग अभी हमारे पास नहीं है।`,
  distance: (km) => `सड़क मार्ग से दूरी ${km} किमी है।`,
  distancePending: "सड़क मार्ग की दूरी का अभी सत्यापन हो रहा है।",
  driveTime: (h) => `सामान्य यात्रा समय लगभग ${h} घंटे है।`,
  drivePending: "यात्रा समय का अभी सत्यापन हो रहा है।",
  details: (p) => `विवरण: ${p}`,
  closedEvery: (p, d) => `${p}: हर ${d} को बंद।`,
  noClosingDay: (p) => `${p}: कोई साप्ताहिक बंद का दिन नहीं।`,
  closingUnconfirmed: (p, c) =>
    `${p}: साप्ताहिक बंद का दिन अभी पक्का नहीं है, क्योंकि ${c ? "प्रकाशित स्रोत एकमत नहीं हैं, इसलिए प्राधिकरण से पुष्टि की जा रही है" : "अभी किसी आधिकारिक स्रोत से इसकी पुष्टि नहीं हुई है"}। कृपया यात्रा से पहले जाँच लें।`,
  hours: (o, c) => `खुलने का समय: ${o}–${c}।`,
  hoursPending: "खुलने के समय का अभी सत्यापन हो रहा है।",
  unesco: "यह यूनेस्को विश्व धरोहर स्थल है।",
  more: (p) => `और जानकारी: ${p}`,
  greeting: "नमस्ते! मैं छत्रपति संभाजीनगर के आसपास के गंतव्यों, हमारे किराए के बारे में बता सकता हूँ और हमारी टीम से कॉल-बैक करवा सकता हूँ।",
  fallback: "मैं बेसिक मोड में हूँ और यह समझ नहीं पाया। किसी स्थान (जैसे एलोरा या शिरडी), किराए या कॉल-बैक के बारे में पूछें।",
  languages: "यह साइट और सहायक अंग्रेज़ी, हिन्दी और मराठी में काम करते हैं।",
  cityName: "हमारी यात्राएँ छत्रपति संभाजीनगर, महाराष्ट्र से शुरू होती हैं।",
  menu: [
    { label: "एलोरा बंद का दिन", message: "क्या एलोरा मंगलवार को बंद रहता है?" },
    { label: "शिरडी का किराया", message: "शिरडी का किराया कितना है?" },
    { label: "किराया कैसे तय होता है", message: "किराया कैसे तय होता है?" },
    { label: "मुझे कॉल करें", message: "कृपया मुझे कॉल-बैक करें" },
  ],
  fareTo: (p) => ({ label: `किराया: ${p}`, message: `${p} तक का किराया कितना है?` }),
  howFar: (p) => ({ label: "कितनी दूर है?", message: `${p} कितनी दूर है?` }),
  callMe: (p) => ({ label: "मुझे कॉल करें", message: p ? `कृपया ${p} की यात्रा के लिए मुझे कॉल-बैक करें` : "कृपया मुझे कॉल-बैक करें" }),
  confirmLabel: "पुष्टि करें",
  cancelLabel: "रद्द करें",
  sent: "भेज दिया। हमारी टीम आपको कॉल करेगी।",
  expired: "यह अनुरोध समाप्त हो गया है या पहले ही निपटाया जा चुका है। फिर से पूछें, मैं नया अनुरोध तैयार कर दूँगा।",
  cancelled: "रद्द किया। कुछ भी सहेजा नहीं गया।",
  sorry: "क्षमा करें, अभी जवाब नहीं दे पाया।",
};

const mr: OfflineStrings = {
  days: { mon: "सोमवारी", tue: "मंगळवारी", wed: "बुधवारी", thu: "गुरुवारी", fri: "शुक्रवारी", sat: "शनिवारी", sun: "रविवारी" },
  join: (xs) => xs.join(" आणि "),
  askPhone: "आमच्या टीमकडून कॉल-बॅकची व्यवस्था करतो. कृपया तुमचे नाव आणि 10 अंकी मोबाइल नंबर पाठवा, उदा.: “98xxxxxxxx वर फोन करा, माझे नाव रवी आहे”.",
  badPhone: "हा 10 अंकी भारतीय मोबाइल नंबर वाटत नाही. कृपया पुन्हा पाठवा.",
  callbackReady: "मी कॉल-बॅक विनंती तयार केली आहे. खालील कार्ड पाहा आणि पाठवण्यासाठी \"खात्री करा\" दाबा. तोपर्यंत काहीही जतन होणार नाही.",
  tripTo: (p) => `${p} सहल`,
  builtIn: ["प्रवास केलेले अंतर (पूर्ण किमी)", "दैनिक किमान अंतराची पूर्तता", "दररोजचा चालक भत्ता", "रात्रभर सहल असल्यास रात्रीचा मुक्काम", "स्वतंत्र ओळीत जीएसटी"],
  actuals: ["टोल", "पार्किंग", "महाराष्ट्राबाहेरचा राज्य प्रवेश कर"],
  promise: "बिल जतन केलेल्या कोटेशनशी जुळवले जाते आणि सहलच बदलली तरच ते बदलते.",
  fareExplain: (b, a) => `प्रत्येक कोटेशनमध्ये संपूर्ण तपशील असतो. भाड्यात समाविष्ट: ${b}. प्रत्यक्ष खर्चानुसार: ${a}.`,
  fareAskWhere: "कुठे जायचे ते सांगा, मी भाडे पाहतो.",
  fareQuote: (p, t) => `छत्रपती संभाजीनगरहून ${p} पर्यंत एकेरी सेडानचे भाडे, नमूद बाबींसह, ${t} आहे. टोल आणि पार्किंग प्रत्यक्ष खर्चानुसार.`,
  fareNotPublished: (p, d) => `${p} पर्यंतचे भाडे अजून प्रसिद्ध झालेले नाही${d ? " (रस्त्याच्या अंतराची पडताळणी सुरू आहे)" : ""}. आमच्या टीमकडून तुम्हाला कोटेशनसाठी फोन करायला सांगू शकतो.`,
  noRoute: (p) => `${p} पर्यंतचा मार्ग अजून आमच्याकडे नाही.`,
  distance: (km) => `रस्त्याने अंतर ${km} किमी आहे.`,
  distancePending: "रस्त्याच्या अंतराची अजून पडताळणी सुरू आहे.",
  driveTime: (h) => `साधारण प्रवास वेळ सुमारे ${h} तास आहे.`,
  drivePending: "प्रवास वेळेची अजून पडताळणी सुरू आहे.",
  details: (p) => `तपशील: ${p}`,
  closedEvery: (p, d) => `${p}: दर ${d} बंद.`,
  noClosingDay: (p) => `${p}: साप्ताहिक सुट्टी नाही.`,
  closingUnconfirmed: (p, c) =>
    `${p}: साप्ताहिक सुट्टीचा दिवस अजून निश्चित नाही, कारण ${c ? "प्रकाशित स्रोतांमध्ये एकमत नाही, त्यामुळे प्राधिकरणाकडून खात्री केली जात आहे" : "अजून अधिकृत स्रोताकडून खात्री झालेली नाही"}. कृपया प्रवासापूर्वी तपासा.`,
  hours: (o, c) => `उघडण्याची वेळ: ${o}–${c}.`,
  hoursPending: "उघडण्याच्या वेळेची अजून पडताळणी सुरू आहे.",
  unesco: "हे युनेस्को जागतिक वारसा स्थळ आहे.",
  more: (p) => `अधिक माहिती: ${p}`,
  greeting: "नमस्कार! मी छत्रपती संभाजीनगरच्या आसपासच्या ठिकाणांबद्दल, आमच्या भाड्याबद्दल सांगू शकतो आणि आमच्या टीमकडून कॉल-बॅक मागवू शकतो.",
  fallback: "मी बेसिक मोडमध्ये आहे आणि हे समजले नाही. एखादे ठिकाण (उदा. वेरूळ किंवा शिर्डी), भाडे किंवा कॉल-बॅकबद्दल विचारा.",
  languages: "ही साइट आणि सहाय्यक इंग्रजी, हिंदी आणि मराठीत काम करतात.",
  cityName: "आमच्या सहली छत्रपती संभाजीनगर, महाराष्ट्र येथून सुरू होतात.",
  menu: [
    { label: "वेरूळ सुट्टीचा दिवस", message: "वेरूळ मंगळवारी बंद असते का?" },
    { label: "शिर्डीचे भाडे", message: "शिर्डीचे भाडे किती आहे?" },
    { label: "भाडे कसे ठरते", message: "भाडे कसे ठरते?" },
    { label: "मला फोन करा", message: "कृपया मला कॉल-बॅक करा" },
  ],
  fareTo: (p) => ({ label: `भाडे: ${p}`, message: `${p} पर्यंतचे भाडे किती आहे?` }),
  howFar: (p) => ({ label: "किती लांब आहे?", message: `${p} किती लांब आहे?` }),
  callMe: (p) => ({ label: "मला फोन करा", message: p ? `कृपया ${p} सहलीसाठी मला कॉल-बॅक करा` : "कृपया मला कॉल-बॅक करा" }),
  confirmLabel: "खात्री करा",
  cancelLabel: "रद्द करा",
  sent: "पाठवले. आमची टीम तुम्हाला फोन करेल.",
  expired: "ही विनंती कालबाह्य झाली आहे किंवा आधीच पूर्ण झाली आहे. पुन्हा विचारा, मी नवीन विनंती तयार करतो.",
  cancelled: "रद्द केले. काहीही जतन केले नाही.",
  sorry: "माफ करा, आत्ता उत्तर देता आले नाही.",
};

export const OFFLINE_STRINGS: Record<Locale, OfflineStrings> = { en, hi, mr };

const MARATHI_HINT = /आहे|आहेत|काय|कधी|किती|मला|माझे|माझं|आणि|सांगा|करा|पाहिजे|हवी|हवे|बद्दल|च्या|ला |ळ/;

/** Reply language: the page language, unless the person writes in Devanagari on the English page. */
export function replyLocale(pageLocale: Locale, text: string): Locale {
  if (pageLocale !== "en" || !/[ऀ-ॿ]/.test(text)) return pageLocale;
  return MARATHI_HINT.test(text) ? "mr" : "hi";
}
