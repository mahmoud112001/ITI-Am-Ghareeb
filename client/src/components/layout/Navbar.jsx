import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AmGhareebAvatar from '../AmGhareebAvatar'

// ── Nav links config ──────────────────────────────────────────────────────────
const NAV_LINKS = [
  { to: '/',       label: 'الرئيسية'     },
  { to: '/search', label: 'البحث'        },
  { to: '/map',    label: 'الخريطة'      },
  { to: '/chat',   label: 'المساعد الذكي' },
]

// ── Active link style helper ──────────────────────────────────────────────────
function navLinkClass({ isActive }) {
  const base = 'text-sm font-semibold transition-colors duration-150 pb-1 '
  return isActive
    ? base + 'text-amber-400 border-b-2 border-amber-400'
    : base + 'text-white hover:text-amber-400'
}

// ── Hamburger icon ────────────────────────────────────────────────────────────
function HamburgerIcon({ open }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {open ? (
        <>
          <line x1="18" y1="6"  x2="6"  y2="18" />
          <line x1="6"  y1="6"  x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3"  y1="6"  x2="21" y2="6"  />
          <line x1="3"  y1="12" x2="21" y2="12" />
          <line x1="3"  y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef(null)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Close drawer on outside click
  useEffect(() => {
    function handleClick(e) {
      if (drawerOpen && drawerRef.current && !drawerRef.current.contains(e.target)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [drawerOpen])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header
      ref={drawerRef}
      style={{ backgroundColor: '#1B2A4A', position: 'relative', zIndex: 50 }}
      className="shadow-lg"
    >
      {/* ── Main bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 md:px-8"
        style={{ height: '64px' }}
      >
        {/* RIGHT — Logo + brand text (RTL: this is the visual right) */}
        <div className="flex items-center gap-3">
          <AmGhareebAvatar size={44} />
          <div className="flex flex-col leading-tight">
            <span
              className="font-bold text-white"
              style={{ fontSize: '1.05rem', lineHeight: '1.2' }}
            >
              عم غريب
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: '#F4A833', lineHeight: '1.2' }}
            >
              دليلك في مواصلات الإسكندرية
            </span>
          </div>
        </div>

        {/* CENTER — Desktop nav links (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* LEFT — User actions (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* Admin dashboard button — only visible to admins */}
              {user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className="text-sm font-bold rounded-lg px-3 py-1.5 transition-all duration-150"
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? '#d4912b' : '#F4A833',
                    color: '#1B2A4A',
                    boxShadow: isActive ? 'inset 0 2px 4px rgba(0,0,0,0.15)' : 'none',
                  })}
                >
                  لوحة التحكم
                </NavLink>
              )}

              <span className="text-sm font-semibold" style={{ color: '#F4A833' }}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-white border border-white rounded-lg px-3 py-1.5 hover:bg-white hover:text-navy transition-colors duration-150"
              >
                خروج
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="text-sm font-medium text-white border border-white rounded-lg px-3 py-1.5 hover:bg-white transition-colors duration-150"
                style={{ color: 'white' }}
              >
                تسجيل الدخول
              </NavLink>
              <NavLink
                to="/register"
                className="text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors duration-150"
                style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
              >
                إنشاء حساب
              </NavLink>
            </>
          )}
        </div>

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden text-white p-1"
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="فتح القائمة"
        >
          <HamburgerIcon open={drawerOpen} />
        </button>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight:       drawerOpen ? '400px' : '0px',
          backgroundColor: '#1B2A4A',
          borderTop:       drawerOpen ? '1px solid rgba(255,255,255,0.1)' : 'none',
        }}
      >
        <nav className="flex flex-col px-4 py-4 gap-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                'text-base font-semibold py-2.5 px-3 rounded-lg transition-colors duration-150 ' +
                (isActive
                  ? 'text-amber-400 bg-white/10'
                  : 'text-white hover:text-amber-400 hover:bg-white/5')
              }
              onClick={() => setDrawerOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="border-t border-white/10 my-1" />

          {/* Auth actions */}
          {user ? (
            <>
              {/* Admin dashboard button — mobile, only visible to admins */}
              {user.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className="text-base font-bold rounded-lg px-3 py-2.5 text-center transition-colors duration-150"
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? '#d4912b' : '#F4A833',
                    color: '#1B2A4A',
                  })}
                  onClick={() => setDrawerOpen(false)}
                >
                  لوحة التحكم
                </NavLink>
              )}

              <span className="text-sm font-semibold px-3 py-1" style={{ color: '#F4A833' }}>
                {user.name}
              </span>
              <button
                onClick={() => { setDrawerOpen(false); handleLogout() }}
                className="text-base font-medium text-white border border-white/40 rounded-lg px-3 py-2.5 text-right hover:bg-white/10 transition-colors"
              >
                تسجيل الخروج
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="text-base font-medium text-white border border-white/40 rounded-lg px-3 py-2.5 text-right hover:bg-white/10 transition-colors"
                onClick={() => setDrawerOpen(false)}
              >
                تسجيل الدخول
              </NavLink>
              <NavLink
                to="/register"
                className="text-base font-semibold rounded-lg px-3 py-2.5 text-center transition-colors"
                style={{ backgroundColor: '#F4A833', color: '#1B2A4A' }}
                onClick={() => setDrawerOpen(false)}
              >
                إنشاء حساب
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}