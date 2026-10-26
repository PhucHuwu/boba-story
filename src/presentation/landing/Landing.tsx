import type { ReactNode } from "react";
import { ARCHETYPES } from "@/domain/catalog";
import { SHIPPER_BRANDS } from "@/domain/delivery";
import type { ArchetypeId, ShipperBrand } from "@/domain/types";
import { art } from "./art";
import { FeedbackForm, LatestAnnouncement, MoodPortrait, PlayButton } from "./islands";

type CastMember = { base: string; name: string; text: string };

const CAT_TEXT: Record<Exclude<ArchetypeId, "shipper">, string> = {
  student: "Ghé quán sau giờ học với chút tiền tiêu vặt. Dễ tính, thích topping và chờ được khá lâu.",
  office: "Lúc nào cũng vội vì sắp họp. Pha nhanh và đúng thì tiền tip rất hậu.",
  regular: "Mochi ở góc phố, khách quen đầu tiên của quán. Mỗi lần ghé lại kể thêm một đoạn chuyện.",
  picky: "Cực kỳ kỹ tính về tỷ lệ trà, sữa, đường, đá. Chỉ ghé khi quán đã có chút tiếng tăm.",
  granny: "Bà ở đầu hẻm, uống ít ngọt và không bao giờ hối. Thích ly nào là bà tặng quà.",
  tiktoker: "Vừa quay vừa gọi món. Pha ngon thì quán lên xu hướng, pha dở thì cả mạng đều biết.",
};

const CAST: CastMember[] = [
  ...(Object.keys(CAT_TEXT) as (keyof typeof CAT_TEXT)[]).map((id) => ({ base: `cat_${id}`, name: ARCHETYPES[id].name, text: CAT_TEXT[id] })),
  ...(Object.keys(SHIPPER_BRANDS) as ShipperBrand[]).map((id) => ({
    base: `shipper_${id}`,
    name: `Shipper ${SHIPPER_BRANDS[id].name}`,
    text: "Mang đơn đặt qua app tới. Pha đủ cả lô trước khi bác shipper hết kiên nhẫn nhé.",
  })),
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Chơi có mất phí không?",
    a: "Hoàn toàn miễn phí, không quảng cáo, không cần tạo tài khoản. Bấm “Chơi ngay” là vào quán.",
  },
  {
    q: "Chơi được trên điện thoại hay iPad không?",
    a: "Được. Game chạy ngay trên trình duyệt của điện thoại, iPad (dọc hoặc ngang) và máy tính. Trên điện thoại có thể thêm vào màn hình chính để mở như một ứng dụng.",
  },
  {
    q: "Tiến trình được lưu ở đâu?",
    a: "Game tự lưu vào trình duyệt sau mỗi ngày. Mở lại trang này trên cùng máy, nút ở đầu trang sẽ hiện “Chơi tiếp” cùng số ngày bạn đang chơi.",
  },
  {
    q: "Đổi máy hoặc xoá dữ liệu trình duyệt thì sao?",
    a: (
      <>
        Trong game, vào <b>Cài đặt → Lưu đám mây</b> để xem <b>mã khôi phục</b> và lưu lên đám mây (cuối mỗi ngày game cũng tự lưu). Trên máy mới, ở menu chính chọn <b>Khôi phục</b> rồi nhập mã. Bản lưu đám mây được giữ 180 ngày
        kể từ lần lưu gần nhất. Hãy giữ mã này bí mật.
      </>
    ),
  },
  {
    q: "Thấy khó quá thì sao?",
    a: (
      <>
        Bật <b>Chế độ thư giãn</b> trong Cài đặt: mèo khách không bỏ về và quán không mất danh tiếng. Bạn cũng có thể bật <b>Gợi ý pha chế</b> để thấy vạch mục tiêu trên ly.
      </>
    ),
  },
  {
    q: "Gặp lỗi thì báo ở đâu?",
    a: "Dùng form góp ý ngay trên trang này hoặc nút Góp ý trong game. Góp ý trong game gửi kèm ngày chơi, số xu và danh tiếng để dễ tìm lỗi, không có thông tin cá nhân.",
  },
];

function SectionTitle({ id, kicker, title, children }: { id: string; kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <p className="text-sm font-extrabold tracking-[0.2em] text-caramel uppercase">{kicker}</p>
      <h2 id={id} className="mt-1 text-3xl leading-tight font-extrabold sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-lg text-cocoa">{children}</p>}
    </div>
  );
}

function Hero() {
  return (
    <header className="relative isolate flex min-h-[100svh] overflow-hidden bg-bean">
      <picture>
        <source media="(orientation: portrait)" srcSet={art("landing_hero_tall")} />
        <img src={art("landing_hero_wide")} alt="Những vị khách mèo xếp hàng trước quầy quán trà sữa" fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-center landscape:object-[75%_center]" />
      </picture>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[rgba(255,248,236,0.95)] via-[rgba(255,248,236,0.85)] via-45% to-transparent to-70% landscape:bg-gradient-to-r landscape:from-[rgba(255,248,236,0.96)] landscape:via-[rgba(255,248,236,0.8)] landscape:via-[rgba(255,248,236,0.88)] landscape:via-40% landscape:to-[62%]" />
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-[max(1.5rem,env(safe-area-inset-top))] text-center landscape:items-start landscape:justify-center landscape:py-10 landscape:text-left landscape:[&>*]:max-w-[min(44vw,34rem)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art("logo")} alt="Boba Story" className="floaty w-[min(56vw,30svh,300px)] drop-shadow-xl landscape:w-[min(26vw,36svh,320px)]" />
        <h1 className="mt-2 max-w-[18em] text-balance text-[clamp(1.5rem,5.5vw,2.6rem)] leading-tight font-extrabold landscape:text-[clamp(1.5rem,3vw,2.6rem)]">Quán trà sữa nhỏ của những vị khách mèo</h1>
        <p className="mt-2 max-w-[26em] text-[clamp(1rem,3.6vw,1.25rem)] font-semibold text-cocoa landscape:text-[clamp(1rem,1.6vw,1.3rem)]">
          Tự tay rót trà, thêm sữa, múc trân châu và đậy nắp từng ly. Phục vụ thật khéo để căn quán nhỏ ngày càng đông khách.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2 landscape:items-start">
          <PlayButton className="min-w-[12em] text-[1.35em]" />
          <span className="text-sm font-bold text-cocoa">Miễn phí · Chơi ngay trên trình duyệt</span>
        </div>
      </div>
      <a
        href="#cast"
        aria-label="Xem dàn khách mèo"
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full border-[3px] border-bean bg-paper px-4 py-1 text-sm font-extrabold shadow-[0_3px_0_var(--bean)]"
      >
        Gặp khách mèo ↓
      </a>
    </header>
  );
}

function Cast() {
  return (
    <section aria-labelledby="cast-title" id="cast" className="mx-auto w-full max-w-6xl scroll-mt-4 px-5 pt-16">
      <SectionTitle id="cast-title" kicker="Dàn khách mèo" title="Ai sẽ ghé quán hôm nay?">
        Mỗi vị khách có khẩu vị và độ kiên nhẫn riêng. Chạm vào từng bạn để xem họ vui, sốt ruột hay buồn.
      </SectionTitle>
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {CAST.map((c) => (
          <li key={c.base} className="panel flex flex-col overflow-hidden !rounded-3xl !shadow-[0_6px_0_rgba(74,44,29,0.45)]">
            <div className="h-44 bg-gradient-to-b from-[#fde9cf] to-[#f6d5ae] px-2 pt-3 sm:h-56">
              <MoodPortrait base={c.base} name={c.name} />
            </div>
            <div className="flex flex-1 flex-col gap-1 border-t-4 border-bean p-3 sm:p-4">
              <h3 className="text-lg leading-tight font-extrabold sm:text-xl">{c.name}</h3>
              <p className="text-sm text-cocoa sm:text-base">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Feedback() {
  return (
    <section aria-labelledby="feedback-title" id="feedback" className="mx-auto w-full max-w-6xl px-5 pt-16">
      <SectionTitle id="feedback-title" kicker="Góp ý" title="Kể cho quán nghe nhé">
        Lỗi, ý tưởng món mới hay độ khó chưa hợp lý, nhà phát triển đọc từng góp ý.
      </SectionTitle>
      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel p-5 sm:p-7">
          <FeedbackForm />
        </div>
        <div aria-labelledby="faq-title">
          <h3 id="faq-title" className="mb-3 text-2xl font-extrabold">
            Câu hỏi thường gặp
          </h3>
          <div className="flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border-[3px] border-bean bg-paper shadow-[0_3px_0_var(--bean)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-lg font-extrabold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-caramel transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="px-4 pb-4 text-cocoa">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art("landing_group")} alt="Cả nhóm khách mèo vẫy tay chào" loading="lazy" className="mx-auto block w-[min(92%,760px)] mix-blend-multiply" />
      <div className="border-t-4 border-bean bg-bean text-cream">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
          <p className="text-2xl font-extrabold">Quán đã mở cửa, khách đang chờ!</p>
          <PlayButton className="min-w-[12em] text-[1.25em]" />
          <p className="text-sm opacity-75">© Boba Story · Game pha chế trà sữa cozy</p>
        </div>
      </div>
    </footer>
  );
}

/** Public home page. The `landing` class unlocks document scrolling (see globals.css). */
export default function Landing() {
  return (
    <div className="landing bg-cream">
      <Hero />
      <main>
        <LatestAnnouncement />
        <Cast />
        <Feedback />
      </main>
      <Footer />
    </div>
  );
}
