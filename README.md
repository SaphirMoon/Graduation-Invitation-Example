# Thư mời tốt nghiệp — câu chuyện có animation

Next.js (App Router) + TypeScript + GSAP + React Three Fiber (three.js).

Giai đoạn hiện tại: **phần mở đầu 3D** (Cảnh 0 rèm + Cảnh 1 trăng sapphire, chạy liền một cú máy). Cảnh 2–6 đang là placeholder.
Máy không hỗ trợ WebGL sẽ tự dùng bản SVG phẳng cũ.

## Chạy local

```bash
pnpm install
pnpm dev             # mở http://localhost:3000
```

- `/` — bản chung: dùng mục có khóa rỗng `""` trong `src/data/guests.json` (tên và album ảnh)
- `/huy`, `/lan`, `/minh` — link riêng (khai báo trong `src/data/guests.json`)
- `/bat-ky-gi` — slug không có trong danh sách → bản chung

Build thử như trên Vercel: `pnpm build && pnpm start`.

## Xem trên điện thoại (cùng wifi)

1. Chạy `pnpm dev:lan` (dev server lắng nghe mọi địa chỉ mạng).
2. Lấy IP máy tính: mở PowerShell, gõ `ipconfig`, tìm dòng **IPv4 Address** của card Wi-Fi (ví dụ `192.168.1.23`).
3. Trên điện thoại mở `http://192.168.1.23:3000/huy`.
4. Nếu không vào được: Windows Firewall có thể hỏi quyền cho Node.js, chọn **Allow** (mạng Private). IP nội bộ dạng `192.168.*`, `10.*`, `172.*` đã được cho phép trong `next.config.ts` (`allowedDevOrigins`).

## Deploy Vercel

Import repo vào Vercel, không cần cấu hình thêm. Nên đặt biến môi trường `NEXT_PUBLIC_SITE_URL` = domain thật (ví dụ `https://thumoi.vercel.app`), để ảnh xem trước khi gửi link (Open Graph) có URL đúng.

## Tham số có thể chỉnh

| Muốn đổi | File | Ghi chú |
|---|---|---|
| Thời lượng 7 đoạn của phần mở đầu 3D | `src/config/timing.ts` → `PROLOGUE_TIMING` | curtain, flight, beam, crystal, shatter, reveal, greet. Bước con co giãn theo |
| Nhịp thở của trăng, chớp mắt, thời gian vẫy tay | `src/config/timing.ts` → `IDLE_TIMING` | |
| Độ dài bản giảm chuyển động | `src/config/timing.ts` → `REDUCED_TOTAL` | |
| **Toàn bộ màu sắc** (3D, thiệp, nút, bản SVG, ảnh OG) | `src/config/theme.ts` → `THEME` | Sửa một chỗ là đổi cả thế giới. Sapphire chỉ dành cho trăng xanh, pha lê, mảnh vỡ và tia sáng |
| **Năm 1:** tiêu đề, thoại, ảnh + caption | `src/data/memories.json` | Ảnh WebP, cạnh dài ~1200px, tối đa 8 ảnh mỗi năm. Thoại: câu đầu mở đầu, câu cuối kết, các câu giữa rải đều giữa các ảnh |
| Nhịp cảnh năm (chèo, thời gian chờ, ảnh bay, chuyển cảnh) | `src/components/year/yearTimeline.ts` → `YEAR_TIMING` | |
| Vị trí thuyền, chỗ ảnh đáp và chỗ ảnh trôi tới, cỡ ảnh, camera hồ | `src/components/three/lake/lakeState.ts` | `BOAT_SPOT`, `heroSpot`, `SLOTS`, `PHOTO`, `LAKE_CAMERA` |
| Sóng nước, vệt trăng, vệt đèn lồng | `src/components/three/lake/Water.tsx` | Shader trong `FRAG` |
| **Năm 2:** tiêu đề, thoại, ảnh + caption (mỗi ảnh một toa) | `src/data/memories.json` → `default.year2` | Ảnh bỏ vào `public/images/y2/`. Mọi câu thoại được nói lúc camera bám đầu tàu; số toa tự theo số ảnh |
| Nhịp tàu | `src/components/year/spaceTimeline.ts` → `SPACE_TIMING` | `hold` = giây khóa mỗi toa, `transfer` / `transferSpeed` = cú vọt sang toa kế. Timeline chỉ tween `trainSpeed`, `cameraTarget`, `cameraBlend`, `cameraRelease` |
| Tốc độ gốc, độ uốn đường ray, kích thước toa, góc camera dọc/ngang, số sao và hạt theo hạng máy | `src/components/three/space/spaceState.ts` | `BASE_SPEED`, `trackY` / `trackZ` (sửa cả `TRACK_GLSL`), `TRAIN`, `SPACE_CAMERA`, `SPACE_BUDGET` |
| Hành tinh, cực quang, biển mây, cột sáng, các lớp sao, vị trí trăng nhỏ | `src/components/three/space/Cosmos.tsx` | `PLANETS`, `MOON_DIR`; màu ở `world.space` trong `theme.ts` |
| **Năm 3:** tiêu đề, thoại, ảnh + caption + độ cao | `src/data/memories.json` → `default.year3` | Ảnh bỏ vào `public/images/y3/` (hiển thị cắt vuông). Câu đầu: chân núi, các câu giữa: mỗi trạm một câu, câu cuối: đỉnh núi |
| Nhịp Năm 3 (rơi xuyên mây, leo, trạm, gió tuyết, đỉnh) | `src/components/year/snowTimeline.ts` → `SNOW_TIMING` | `holdStation`, `leg`, `gust`, `gustLength` |
| Hình núi, đường leo, vị trí trạm, camera, số hạt | `src/components/three/snow/snowState.ts` | `PEAK`, `SWITCHBACKS`, `STATION_U`, `SNOW_CAMERA`, `SNOW_BUDGET` |
| Màu núi tuyết, băng, đèn, cờ, trang phục người dẫn | `src/config/theme.ts` → `world.snow3` | |
| **Năm 4:** tiêu đề, thoại, ảnh + caption | `src/data/memories.json` → `default.year4` | Ảnh bỏ vào `public/images/y4/` (hiển thị cắt vuông, tối đa 4 ảnh). Câu đầu: mở đầu, các câu giữa: mỗi bảng ảnh một câu, câu cuối: trên đảo |
| Nhịp Năm 4 (đèn, tia sáng, dựng cầu, tốc độ đi, thời gian ở mỗi ảnh) | `src/components/year/bridgeTimeline.ts` → `BRIDGE_TIMING` | `build`, `speed`, `holdBoard` |
| Đường cầu, vị trí đảo và bảng ảnh, camera, số đèn | `src/components/three/bridge/bridgeState.ts` | `CURVE`, `ISLAND`, `BOARD_U`, `BRIDGE_CAMERA`, `BRIDGE_BUDGET` |
| Màu cầu, đảo, hải đăng, đèn trời | `src/config/theme.ts` → `world.bridge` | |
| Ánh sáng, sương, bloom, vignette, film grain | `src/config/theme.ts` → `GRADE` | `hemi` / `fill` là độ sáng đất, `rimGround` / `rimRock` là viền sáng phía trăng, `skyMist` / `skyMistWarm` là dải chân trời. Năm 1 dùng `GRADE.lake` |
| Màu riêng của Năm 1, Năm 2 | `src/config/theme.ts` → `world.lake`, `world.space` | Cảnh 0, 1 và thiệp dùng các giá trị còn lại trong `world` |
| Đường đi con suối | `src/config/world.ts` → `STREAM` | Các điểm `[x, z]` |
| Đường bay camera, điểm nhìn, độ nghiêng, FOV dọc/ngang | `src/config/world.ts` → `CAMERA` | `path` là các điểm CatmullRom |
| Vị trí / độ cao ngọn đồi chính, hình thung lũng | `src/config/world.ts` → `HILL`, `terrainHeight` | |
| Vị trí trăng (lệch trái / độ cao) | `src/config/world.ts` → `placeMoon` | |
| Số sao, đom đóm, cỏ, đá, bụi (theo hạng máy) | `src/config/world.ts` → `BUDGET` | `high` / `low` |
| Chromatic aberration | `src/components/three/Effects.tsx` | `CA_BASE` / `CA_SPIKE` = độ lệch màu lúc thường / lúc va chạm |
| Nhịp VFX lúc va chạm (hit-stop, flash, xoáy mảnh, bùng sáng, bụi tuyết) | `src/components/three/prologueTimeline.ts` → đoạn 5 | `HIT_STOP`, `SPIRAL` (thời gian mảnh văng + xoay + lao vào). Tăng `SPIRAL` thì tăng `shatter` trong `timing.ts` tương ứng |
| Số mảnh vỡ, số vòng xoay quanh trăng, độ nghiêng vành xoáy | `src/components/three/shards.ts` | `SHARD_COUNT`, `ORBIT_TURNS`, `ORBIT_TILT`, `ORBIT_ROLL` |
| Bề mặt trăng (hố, biển tối, độ gồ, độ mịn lưới) | `src/components/three/moonGeometry.ts`, `objects/Moon.tsx` | `MARIA`, `RELIEF`, `DISPLACE`, `MOON_DETAIL` |
| Số hạt lấp lánh, bụi tuyết, vệt mảnh vỡ (theo hạng máy) | `src/config/world.ts` → `BUDGET` | `sparks`, `snow`, `ghosts` |
| Âm lượng, file âm thanh từng cue | `src/config/audio.ts` | để `null` = âm tổng hợp sẵn; hướng dẫn trong `public/audio/README.md` |
| Shader (rèm, tia sáng, mây, sao, hạt) | `src/components/three/shaders.ts` | |
| Câu thoại, chữ trên nút, "Chạm để mở", chú thích "người hướng dẫn" | `src/config/story.ts` | Dùng được `{name}` |
| Bật/tắt hiện tên khách | `src/config/story.ts` → `showGuestName` | Đang `false` |
| Danh sách khách | `src/data/guests.json` | |
| **Thiệp mời:** giờ, ngày, địa điểm, link bản đồ, lời chúc, chữ ký, ảnh | `src/config/invitation.ts` | Ngày dạng `dd/mm/yyyy`, thứ trong tuần tự tính. Lời chúc dùng được `{name}` |
| Nút "Xác nhận tham dự" | `src/config/invitation.ts` → `rsvp` | `enabled: true` + `url` (Google Form, Messenger…) |
| File lịch .ics (tiêu đề, mô tả, nhắc trước bao lâu) | `src/config/invitation.ts` → `calendar` | `reminderMinutes: 0` = không nhắc |
| Vị trí trăng phía sau thiệp | `src/config/invitation.ts` → `moonScreen` | toạ độ màn hình −1..1, dọc / ngang |
| Nhịp mở thư, tốc độ "viết tay", mũ tốt nghiệp | `src/components/invitation/inviteTimeline.ts` | `PER_CHAR` = giây mỗi ký tự |
| Font chữ viết tay, font tên khách | `src/app/layout.tsx` | Playwrite VN (`--font-hand`), Love Light (`--font-name`) |
| Bố cục, màu giấy, cỡ chữ của thiệp | `src/components/scenes/Invitation.module.css` | Cỡ chữ theo `cqi` (% bề rộng thiệp) |

**Xem nhanh một thời điểm:** thêm `?t=6` vào URL (ví dụ `http://localhost:3000/?t=6`), timeline sẽ nhảy tới giây thứ 6 và dừng lại. Dùng để chỉnh từng khung hình.

**Mở thẳng một cảnh:** `?scene=invitation` (ví dụ `http://localhost:3000/huy?scene=invitation`). Kết hợp được với `?t=`: `?scene=invitation&t=5` là thư đã mở, đang ở giây thứ 5.

**Thay ảnh Năm 1:** bỏ ảnh thật vào `public/images/y1/` (đang là ảnh mẫu), rồi sửa đường dẫn và caption trong `src/data/memories.json`. Thêm năm khác: thêm khối `year2` vào file đó và đổi `PlaceholderScene` thành `Year` trong `src/components/scenes/index.ts`. Xem nhanh: `?scene=year1`, kết hợp `&t=photo2` hoặc `&t=20`.

**Video kỷ niệm (Cloudinary):**

1. Cài ffmpeg một lần: `winget install --id Gyan.FFmpeg -e`, rồi mở lại terminal.
2. Chép video vào `raw-videos/`, tên file là id, ví dụ `raw-videos/guest-y2-nhac-cu.mp4`. Thư mục này không được commit.
3. Chạy `pnpm upload-videos`. Script nén video, tạo poster, upload và cập nhật `src/data/photos.json`. Thêm `--force` để thay video đã upload.
4. Sửa `caption` trong `photos.json` nếu là video mới. Muốn lấy poster ở giây khác thì đặt `posterAt` rồi chạy lại với `--force`.
5. Gắn vào album trong `src/data/memories.json`: `{ "video": "<id>" }`, thêm `altitude` hoặc `focus` nếu cảnh cần.
6. Commit `photos.json` và `public/images/videos/`, rồi deploy lại.

Trên Vercel cần 3 biến `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Video trong album của mục khóa rỗng trong `guests.json` (trang `/` và link lạ) thì ai vào trang cũng xem được; album riêng cần đúng slug của khách đó.

**Ảnh riêng cho từng người:**

1. Xuất ảnh WebP, cạnh dài khoảng 1200px, vào `public/images/<album>/y1/` (ví dụ `public/images/phong/y1/01.webp`).
2. Trong `src/data/memories.json`, thêm vào `albums`: `"phong": { "year1": { "photos": [{ "src": "...", "caption": "..." }] } }`. Chỉ cần ghi năm và mục khác với `default`.
3. Trong `src/data/guests.json`, thêm `"phong": { "name": "Phong", "self": "mình", "album": "phong" }` (`self` là cách bạn xưng với người đó: `em`, `mình`…; bỏ trống thì là `mình`). Link của người đó là `/phong`.

**Một nhóm dùng chung album (ví dụ các cốt):** trong `src/data/guests.json`, mục `"cot"` là trang chung `/cot`, còn mỗi người là `"cot/huy": { "name": "Thanh Huy", "self": "mình", "album": "cot" }`, với link `/cot/huy`. Chỉ tên trên thiệp khác nhau. Nhóm mới cần thêm thư mục route giống `src/app/cot/`.

**Ảnh của bạn:** ba ảnh nền trong suốt trong `public/images/me/` (`small`, `c3`, `now`: nhỏ, lớn, hiện tại), cắt phẳng ở đáy. Kích thước ghi trong `src/data/timeline.ts`. Ảnh mẫu đi kèm chỉ là hình bóng người.

## Cấu trúc

```
src/config/            theme.ts (mọi màu + grading) · story.ts · timing.ts · world.ts (3D) · invitation.ts (thiệp) · audio.ts
src/data/guests.json
src/app/               page.tsx (/) · [slug]/page.tsx · og/route.tsx (ảnh OG)
src/components/
  Story.tsx            điều phối cảnh
  scenes/              index.ts (thứ tự cảnh) · Prologue (3D + fallback) · Invitation (phong thư → thiệp) · PlaceholderScene
                       Scene0Curtain · Scene1Moon (bản SVG khi không có WebGL)
  three/               Stage3D (Canvas) · prologueTimeline (GSAP master timeline) · stage.ts (state chung)
                       CameraRig · Atmosphere · Effects · shaders.ts
    objects/           Sky · Terrain · Moon · LightCone · Crystal (+ Trail, Sparks, Shards) · Rings · Snow
                       Curtain3D · StickFigure3D · Motes
                       shards.ts (quỹ đạo mảnh vỡ dùng chung cho mảnh, vệt và phản ứng của trăng)
  year/                yearTimeline.ts · spaceTimeline.ts · snowTimeline.ts · bridgeTimeline.ts (GSAP) · Lightbox
  three/bridge/        BridgeStage3D (camera, đèn trời) · Bridge (ván, lan can, tia sáng) · Island · Boards · Traveler · bridgeState
  three/snow/          SnowStage3D (camera, mây, rơi xuyên mây) · Mountain · Hiker · Stations (khối băng, đèn, cờ, cột mốc) · Snowfall · snowState
  three/space/         SpaceStage3D · Cosmos (trời, sao, biển mây, hành tinh) · Track · Train (tàu cao tốc) · spaceState
  three/lake/          LakeStage3D · Water · Boat (người dẫn, mái chèo, đèn lồng) · Photos (polaroid) · lakeState
  invitation/          Art.tsx (dấu sapphire, phong thư, icon, mũ — SVG) · inviteTimeline.ts (GSAP)
  three/InviteStage3D  nền trời đêm + trăng xanh của cảnh thiệp
src/lib/               ics.ts (tạo file lịch) · format.ts (điền {name})
src/lib/audio/         sfx.ts (Web Audio, bật/tắt, nhớ lựa chọn) · synth.ts (âm placeholder)
  characters/          SpeechBubble (viền vẽ tay, gõ chữ) · StickFigure (bản SVG)
  ui/                  NextButton · SkipButton
```

**Thêm cảnh mới:** tạo component nhận `SceneProps` (`src/components/scenes/types.ts`), rồi thay placeholder tương ứng trong `src/components/scenes/index.ts`.

## Giấy phép

Mã nguồn phát hành theo giấy phép [MIT](LICENSE), Copyright (c) 2026 SaphirMoon. Ai cũng được dùng, sửa và phân phối lại, miễn là giữ nguyên dòng bản quyền và nội dung giấy phép trong mọi bản sao.
