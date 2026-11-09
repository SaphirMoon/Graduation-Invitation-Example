# Âm thanh

Đặt file âm thanh của bạn vào thư mục này rồi khai báo đường dẫn trong `src/config/audio.ts`
(mục `files`). Cue nào để `null` sẽ dùng âm thanh tổng hợp sẵn bằng Web Audio API.

| Cue | Khi nào phát | Tên file gợi ý |
|---|---|---|
| `curtain` | Rèm mở | `curtain.mp3` |
| `moon` | Trăng sáng dần | `moon.mp3` |
| `chime` | Pha lê được tia sáng chiếu (chuông) | `chime.mp3` |
| `rise` | Pha lê vút lên | `rise.mp3` |
| `impact` | Chạm trăng (boom + thủy tinh vỡ) | `impact.mp3` |
| `swirl` | Các mảnh xoáy vào trăng | `swirl.mp3` |
| `chord` | Trăng đổi xanh (hợp âm) | `chord.mp3` |
| `whoosh` | Tàu vọt lên sang toa kế (Năm 2), rơi xuyên mây (Năm 3) | `whoosh.mp3` |
| `step` | Bước chân trên tuyết (Năm 3) | `step.mp3` |
| `icebell` | Khối băng (Năm 3) và bảng ảnh (Năm 4) sáng lên | `icebell.mp3` |
| `plank` | Bước chân trên cầu ánh sáng (Năm 4) | `plank.mp3` |

Âm lặp (mục `loops` trong `src/config/audio.ts`, file phải lặp liền mạch):

| Cue | Khi nào phát | Tên file gợi ý |
|---|---|---|
| `train` | Tiếng tàu cao tốc lao đi (Năm 2), âm lượng theo tốc độ | `train-loop.mp3` |
| `cosmos` | Tiếng ngân vũ trụ (Năm 2) | `cosmos-loop.mp3` |
| `wind` | Gió núi (Năm 3), mạnh dần theo độ cao và lúc gió tuyết | `wind-loop.mp3` |

Ví dụ: `chime: "/audio/chime.mp3",`

Nên dùng file ngắn (dưới 5 giây), định dạng `.mp3` hoặc `.ogg`, đã cắt khoảng lặng ở đầu.
