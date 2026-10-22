import type { Rng } from "./customers";
import type { RivalEventId } from "./types";

/** Name of the shop across the street. */
export const RIVAL_NAME = "Trà Sữa Chó Mập";

/** A temporary modifier on the business day. `duration` is in simulated seconds (Infinity = rest of day). */
export type Effect =
  | { kind: "priceMul" | "spawnMul" | "decayMul" | "pourMul"; value: number; duration: number }
  | { kind: "malus"; chance: number; texts: string[]; duration: number }
  | { kind: "trash"; count: number }
  | { kind: "fakeReviews"; count: number };

export interface RivalOutcome {
  cost: number;
  reputation: number;
  effects: Effect[];
  message: string;
  /** Counts as beating the rival for stats/quests. */
  win: boolean;
  /** The player retaliated with fake reviews of their own and got caught. */
  caught?: boolean;
}

export interface RivalOption {
  label: string;
  hint: string;
  cost: number;
  resolve(rng: Rng): RivalOutcome;
}

export interface RivalEventDef {
  id: RivalEventId;
  title: string;
  icon: string;
  story: string;
  /** Applied as soon as the event fires, whatever the player chooses. */
  immediate: Effect[];
  options: RivalOption[];
}

const REST = Infinity;
const ok = (o: Partial<RivalOutcome> & Pick<RivalOutcome, "message">): RivalOutcome => ({ cost: 0, reputation: 0, effects: [], win: false, ...o });

export const TRASH_TEXTS = ["Quán bẩn, có vỏ lon dưới chân tớ. Ghê!", "Trước cửa đầy rác, tưởng bãi phế liệu.", "Tớ giẫm phải vỏ chuối ngay cửa. 1 sao cho cái chân."];
const KARAOKE_TEXTS = ["Ồn quá, nghe như mèo bị giẫm đuôi.", "Đang uống thì bên kia hát 'Em của ngày hôm qua' lạc tông. Hết ngon."];
const NOISE_WAR_TEXTS = ["Hai quán thi nhau mở nhạc, đau đầu muốn xỉu.", "Tưởng vào quán trà sữa, hoá ra vào sàn nhảy."];

export const RIVAL_EVENTS: Record<RivalEventId, RivalEventDef> = {
  discount: {
    id: "discount",
    title: "Đối thủ xả hàng giảm 50%!",
    icon: "🐶💸",
    story: `${RIVAL_NAME} treo băng rôn "GIẢM 50% — TRÀ SỮA BÊN KIA ĐẮT LẮM!". Mèo khách bắt đầu ngó sang bên đó...`,
    immediate: [],
    options: [
      {
        label: "Giảm giá theo 30%",
        hint: "Khách vẫn đông nhưng mỗi ly lãi ít hẳn.",
        cost: 0,
        resolve: () => ok({ effects: [{ kind: "priceMul", value: 0.7, duration: REST }], message: "Bạn giảm giá theo. Chiến tranh giá chính thức bắt đầu!" }),
      },
      {
        label: "Giữ giá, tin vào chất lượng",
        hint: "Vắng khách hẳn nửa ngày, nhưng mỗi ly vẫn đủ giá.",
        cost: 0,
        resolve: () => ok({ effects: [{ kind: "spawnMul", value: 1.7, duration: 70 }], message: "Bạn giữ giá. Quán vắng hẳn một lúc..." }),
      },
      {
        label: "Phát tờ rơi 'Ly thứ 2 tặng tip'",
        hint: "Tốn 60 xu in tờ rơi, khách quay lại nhanh và tip nhiều hơn.",
        cost: 60,
        resolve: (rng) =>
          rng() < 0.7
            ? ok({ cost: 60, effects: [{ kind: "spawnMul", value: 0.85, duration: 60 }], win: true, reputation: 2, message: "Tờ rơi hiệu quả! Mèo khách kéo về đông nghịt." })
            : ok({ cost: 60, effects: [{ kind: "spawnMul", value: 1.4, duration: 50 }], message: "Gió thổi bay sạch tờ rơi vào cống. Mất tiền oan..." }),
      },
    ],
  },
  trash: {
    id: "trash",
    title: "Có kẻ vứt rác trước quán!",
    icon: "🐶🗑️",
    story: `Một con chó đeo kính râm (rất giống nhân viên ${RIVAL_NAME}) vừa đổ nguyên túi rác trước cửa rồi chạy mất. Khách bắt đầu nhăn mặt...`,
    immediate: [{ kind: "trash", count: 6 }],
    options: [
      {
        label: "Tự dọn (chạm vào từng món rác)",
        hint: "Miễn phí, nhưng tốn thời gian giữa giờ đông khách.",
        cost: 0,
        resolve: () => ok({ message: "Xắn tay áo lên! Chạm vào rác để dọn." }),
      },
      {
        label: "Thuê mèo dọn dẹp",
        hint: "Tốn 70 xu, sạch ngay lập tức.",
        cost: 70,
        resolve: () => ok({ cost: 70, effects: [{ kind: "trash", count: 0 }], message: "Đội mèo vệ sinh dọn sạch trong nháy mắt." }),
      },
      {
        label: "Ném trả rác sang bên kia",
        hint: "Miễn phí và hả giận... nếu không bị bắt quả tang.",
        cost: 0,
        resolve: (rng) =>
          rng() < 0.5
            ? ok({ effects: [{ kind: "trash", count: 0 }], win: true, message: "Vèo! Rác bay về đúng chủ. Bên kia tức anh ách." })
            : ok({
                reputation: -6,
                effects: [{ kind: "malus", chance: 0.4, texts: ["Thấy chủ quán ném rác sang quán khác. Mất văn hoá!"], duration: 60 }],
                message: "Bị mèo đi đường quay clip! Danh tiếng giảm, rác vẫn còn nguyên.",
              }),
      },
    ],
  },
  fakeReviews: {
    id: "fakeReviews",
    title: "Bão đánh giá 1 sao!",
    icon: "🐶📱",
    story: `Tự nhiên có 4 tài khoản lạ vào chấm quán 1★, tài khoản nào cũng có avatar là... chó. Chắc chắn là ${RIVAL_NAME}!`,
    immediate: [{ kind: "fakeReviews", count: 4 }],
    options: [
      {
        label: "Báo cáo với nền tảng",
        hint: "Tốn 40 xu phí xác minh, khả năng cao được gỡ.",
        cost: 40,
        resolve: (rng) =>
          rng() < 0.75
            ? ok({ cost: 40, win: true, effects: [{ kind: "fakeReviews", count: 0 }], message: "Nền tảng xác nhận review giả và gỡ hết!" })
            : ok({ cost: 40, message: "Nền tảng trả lời: 'Chúng tôi sẽ xem xét trong 3–5 tuần'. Ôi..." }),
      },
      {
        label: "Phản đòn: review giả cho quán chó",
        hint: "Miễn phí. Nhưng nếu bị lộ thì thành trò cười cả phố.",
        cost: 0,
        resolve: (rng) =>
          rng() < 0.45
            ? ok({ win: true, effects: [{ kind: "spawnMul", value: 0.85, duration: 60 }], message: "Khách bên kia bỏ sang quán bạn! (Lương tâm hơi cắn rứt.)" })
            : ok({ reputation: -8, caught: true, message: "Bị phát hiện dùng chung IP! Mèo khách viết bài bóc phốt quán bạn." }),
      },
      {
        label: "Kệ, phục vụ thật tốt để át đi",
        hint: "Không tốn gì. Đánh giá thật sẽ dần đẩy review giả xuống.",
        cost: 0,
        resolve: () => ok({ message: "Bạn hít thở sâu và tập trung pha chế. Chất lượng sẽ lên tiếng." }),
      },
    ],
  },
  powerCut: {
    id: "powerCut",
    title: "Vòi trà bị ai đó phá!",
    icon: "🐶🔧",
    story: "Ống dẫn trà bị bóp méo một cách đáng ngờ, bên cạnh còn vương vài sợi lông chó. Vòi chỉ chảy nhỏ giọt!",
    immediate: [{ kind: "pourMul", value: 0.45, duration: 18 }],
    options: [
      {
        label: "Gọi thợ sửa gấp",
        hint: "Tốn 50 xu, vòi chảy lại bình thường ngay.",
        cost: 50,
        resolve: () => ok({ cost: 50, effects: [{ kind: "pourMul", value: 1, duration: 0 }], message: "Thợ mèo sửa xong trong một nốt nhạc." }),
      },
      {
        label: "Tự xoay xở",
        hint: "Miễn phí, nhưng rót chậm hơn một nửa trong một lúc lâu.",
        cost: 0,
        resolve: () => ok({ effects: [{ kind: "pourMul", value: 0.45, duration: 60 }], message: "Rót chậm thôi, kiên nhẫn là một đức tính..." }),
      },
    ],
  },
  karaoke: {
    id: "karaoke",
    title: "Karaoke tra tấn bên kia đường",
    icon: "🐶🎤",
    story: `${RIVAL_NAME} kéo loa kẹo kéo ra vỉa hè hát karaoke hết công suất, quay loa về phía quán bạn. Mèo khách cụp tai, mất kiên nhẫn...`,
    immediate: [
      { kind: "decayMul", value: 1.35, duration: 15 },
      { kind: "malus", chance: 0.45, texts: KARAOKE_TEXTS, duration: 15 },
    ],
    options: [
      {
        label: "Sang tặng quà xin vặn nhỏ",
        hint: "Tốn 30 xu tiền bánh, êm đẹp.",
        cost: 30,
        resolve: (rng) =>
          rng() < 0.8
            ? ok({ cost: 30, win: true, effects: [{ kind: "decayMul", value: 1, duration: 0 }, { kind: "malus", chance: 0, texts: [], duration: 0 }], message: "Chó Mập nhận bánh và vặn nhỏ loa. Hoà bình lập lại." })
            : ok({
                cost: 30,
                effects: [{ kind: "decayMul", value: 1.35, duration: 50 }, { kind: "malus", chance: 0.45, texts: KARAOKE_TEXTS, duration: 50 }],
                message: "Nó ăn bánh xong... hát to hơn! Mất cả chì lẫn chài.",
              }),
      },
      {
        label: "Mở nhạc to hơn đáp trả",
        hint: "Miễn phí. Không ai át được ai, khách hai bên đều khổ.",
        cost: 0,
        resolve: () =>
          ok({
            effects: [{ kind: "decayMul", value: 1.15, duration: 60 }, { kind: "malus", chance: 0.35, texts: NOISE_WAR_TEXTS, duration: 60 }],
            message: "Cuộc chiến âm thanh bắt đầu! Tai mèo nào cũng cụp.",
          }),
      },
      {
        label: "Chịu đựng",
        hint: "Không tốn xu nào, khách khó chịu một lúc.",
        cost: 0,
        resolve: () =>
          ok({
            effects: [{ kind: "decayMul", value: 1.35, duration: 60 }, { kind: "malus", chance: 0.45, texts: KARAOKE_TEXTS, duration: 60 }],
            message: "Bạn đeo nút tai và cầu nguyện.",
          }),
      },
    ],
  },
};

export const FAKE_REVIEW_TEXTS = [
  "Trà như nước cống. Bên kia đường ngon hơn nhiều. Gâu.",
  "Phục vụ tệ. Gợi ý: sang Chó Mập uống nhé. Gâu gâu.",
  "1 sao vì không có xương gặm. Gâu.",
  "Chủ quán là mèo. Tôi không thích mèo. 1 sao.",
];
