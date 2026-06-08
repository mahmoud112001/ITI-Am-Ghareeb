import { useNavigate } from 'react-router-dom'
import AmGhareebAvatar from '../components/AmGhareebAvatar'

// ── Stats data ────────────────────────────────────────────────────────────────
const STATS = [
  { value: '+10',  label: 'خطوط موثقة'    },
  { value: '100%', label: 'مجاناً دايماً'  },
  { value: 'عربي', label: 'بالعربي دايماً' },
]

// ── Features data ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon:  '🔍',
    title: 'بحث ذكي',
    desc:  'ادخل من فين ورايح فين — عم غريب بيلاقيلك أحسن خط مشروع على طول',
  },
  {
    icon:  '🗺️',
    title: 'خريطة تفاعلية',
    desc:  'شوف محطات الخط على الخريطة وخطط مشوارك بصرياً',
  },
  {
    icon:  '🤖',
    title: 'مساعد ذكي',
    desc:  'اسأل عم غريب بالعامية الإسكندرانية — هيجاوبك بالتفصيل زي ما هو عارف',
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div dir="rtl" style={{ fontFamily: 'Cairo, sans-serif' }}>

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <section
        className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-16"
        style={{ backgroundColor: '#1B2A4A' }}
      >
        {/* Glowing amber halo + avatar */}
        <div
          className="mb-8 rounded-full flex items-center justify-center"
          style={{
            width:     148,
            height:    148,
            boxShadow: '0 0 0 12px rgba(244,168,51,0.15), 0 0 0 24px rgba(244,168,51,0.07)',
            backgroundColor: 'rgba(244,168,51,0.08)',
          }}
        >
          <AmGhareebAvatar size={120} />
        </div>

        <h1
          className="text-5xl md:text-6xl font-black text-white mb-3"
          style={{ letterSpacing: '-0.02em' }}
        >
          عم غريب
        </h1>

        <h2
          className="text-xl md:text-2xl font-bold mb-5"
          style={{ color: '#F4A833' }}
        >
          دليلك الذكي في مواصلات الإسكندرية
        </h2>

        <p className="text-base md:text-lg text-white/80 max-w-xl mb-10 leading-relaxed">
          مش عارف تروح فين؟ اسأل عم غريب — بيعرف كل مشروع وكل محطة في الإسكندرية
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={() => navigate('/search')}
            className="px-8 py-3.5 rounded-xl text-base font-bold border-2 border-white text-white transition-all hover:bg-white"
            style={{ minWidth: 180 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.color = '#1B2A4A'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = 'white'
            }}
          >
            ابحث عن خط
          </button>
          <button
            onClick={() => navigate('/chat')}
            className="px-8 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90"
            style={{ minWidth: 180, backgroundColor: '#F4A833', color: '#1B2A4A' }}
          >
            اسأل عم غريب
          </button>
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center gap-2 opacity-50">
          <span className="text-white text-xs">اكتشف أكتر</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <section className="py-12 px-6" style={{ backgroundColor: '#FDF6EC' }}>
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center text-center p-6 rounded-2xl shadow-sm"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <span className="text-3xl md:text-4xl font-black mb-1" style={{ color: '#F4A833' }}>
                {s.value}
              </span>
              <span className="text-sm font-semibold" style={{ color: '#1B2A4A' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features section ─────────────────────────────────────────────── */}
      <section className="py-16 px-6" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="max-w-4xl mx-auto">
          <h3 className="text-center text-2xl font-black mb-10" style={{ color: '#1B2A4A' }}>
            إيه اللي بيقدمه عم غريب؟
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 text-center transition-shadow hover:shadow-lg"
                style={{ backgroundColor: '#FDF6EC', border: '2px solid transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.border = '2px solid #F4A833')}
                onMouseLeave={(e) => (e.currentTarget.style.border = '2px solid transparent')}
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h4 className="text-lg font-bold mb-2" style={{ color: '#1B2A4A' }}>
                  {f.title}
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="py-16 px-6 text-center" style={{ backgroundColor: '#1B2A4A' }}>
        <AmGhareebAvatar size={64} className="mx-auto mb-4" />
        <h3 className="text-2xl font-black text-white mb-2">جرّب دلوقتي — مجاناً</h3>
        <p className="text-white/70 text-sm mb-6">مش محتاج حساب عشان تبحث عن خط</p>
        <button
          onClick={() => navigate('/search')}
          className="px-10 py-3.5 rounded-xl text-base font-bold transition-all hover:opacity-90"
          style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
        >
          ابدأ البحث
        </button>
      </section>
    </div>
  )
}
