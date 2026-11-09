/**
 * INVITATION CARD — event data and copy for the final scene. Edit freely.
 * Templates may use {name} (how the guest is addressed) and {self} (how the host refers
 * to himself with that guest: "em", "mình"), both from data/guests.json.
 * `/` and unknown slugs use the entry with an empty key.
 */
export const INVITATION = {
  heading: "THƯ MỜI LỄ TỐT NGHIỆP",
  /** First handwritten line, then the guest line below it */
  greeting: "Thân gửi",
  guestLine: "{name},",
  wish: "Hy vọng {name} có thể đến dự lễ và cùng chung vui với {self}.",

  event: {
    /** 24 h "HH:mm" */
    start: "13:00",
    end: "14:15",
    /** "dd/mm/yyyy" (the weekday is added automatically). The calendar button needs a real date. */
    date: "07/11/2026",
    /** UTC offset of the venue (Vietnam) */
    utcOffset: "+07:00",
    place: "Hội trường A",
    placeDetail: "Trường của bạn",
    mapUrl: "https://maps.google.com",
  },

  signOff: "Thân mến,",
  signature: "Tên của bạn",

  /** Calendar file (.ics) contents */
  calendar: {
    title: "Lễ tốt nghiệp",
    description: "Hẹn gặp bạn ở lễ tốt nghiệp nhé!",
    fileName: "le-tot-nghiep-xuan-phu.ics",
    /** Reminder before the start, in minutes (0 = none) */
    reminderMinutes: 120,
  },

  /** Optional "Xác nhận tham dự" button: set enabled = true and a link (Google Form, Messenger…) */
  rsvp: {
    enabled: false,
    url: "",
  },

  /** Where the moon sits on screen behind the card (normalized device coords, -1..1) */
  moonScreen: {
    portrait: { x: 0, y: 0.62 },
    landscape: { x: -0.52, y: 0.42 },
  },

  ui: {
    tapHint: "Chạm để mở thư",
    map: "Xem đường đi",
    calendar: "Thêm vào lịch",
    rsvp: "Xác nhận tham dự",
    /** Shown when the calendar button is pressed before the date is set */
    dateSoon: "Ngày lễ sẽ được cập nhật sớm nhé!",
    portraitReplay: "Xem lại",
    scrollHint: "Kéo xuống nhé",
    portraitDot: "Xem ảnh",
  },
} as const;
