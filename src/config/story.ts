/**
 * COPY — every piece of on-screen text lives here.
 * Templates may use {name} (how the guest is addressed).
 */
export const STORY = {
  /**
   * false: never show the guest's name (dialogue + link preview title).
   * Set to true to personalize using data/guests.json.
   */
  showGuestName: false,

  ui: {
    next: "Tiếp →",
    close: "Đóng",
    viewPhoto: "Xem ảnh",
    viewVideo: "Xem video",
    videoLoading: "Đang tải video...",
    videoError: "Không phát được video này. Bạn thử lại nhé.",
    retry: "Thử lại",
    skip: "Bỏ qua",
    restart: "Xem lại từ đầu ↺",
    soundOn: "Bật âm thanh",
    soundOff: "Tắt âm thanh",
  },

  scene0: {
    tapHint: "Chạm để mở",
  },

  scene1: {
    /** Caption above the speech bubble text */
    speaker: "người hướng dẫn",
    /** Used when showGuestName = true and the guest is in the list */
    greetingPersonal: "Chào {name}! Mình là người hướng dẫn. Đi cùng mình nhé!",
    /** Used for the generic version */
    greetingGeneric: "Xin chào! Mình là người hướng dẫn của hành trình này. Đi cùng mình nhé!",
  },

  /** Labels for scenes not built yet */
  placeholders: {
    year1: "Năm 1",
    year2: "Năm 2",
    year3: "Năm 3",
    year4: "Năm 4",
    invitation: "Thiệp mời",
  } as Record<string, string>,
  placeholderNote: "Chặng này đang được chuẩn bị",

  /** Title & description for shared links (Open Graph) */
  meta: {
    title: "Một lời mời đặc biệt 🌙",
    titlePersonal: "Lời mời gửi đến {name} 🌙",
    description: "Chạm để mở một câu chuyện nhỏ dưới ánh trăng.",
  },
} as const;
