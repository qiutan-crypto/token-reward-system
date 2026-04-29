'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RewardCatalog } from '@/types'
import GoldCoin from '@/components/GoldCoin'

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a)
}

// Compute pile/rain parameters based on actual viewport size so the mound
// scales naturally — small windows get fewer/smaller coins, big windows get more.
function computePileParams() {
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700

  // Mound width scales with viewport width (capped so it doesn't become a lake)
  const baseSpreadPx = Math.min(620, Math.max(180, vw * 0.40))
  // Mound height: ~32% of viewport height, capped so the pile doesn't crowd the big coin
  const peakPx       = Math.min(320, Math.max(140, vh * 0.32))
  // Coin sizes scale with viewport height so coins feel proportional on every screen
  const sizeMin      = Math.max(34, Math.min(60, vh * 0.06))
  const sizeMax      = sizeMin + Math.max(22, Math.min(50, vh * 0.05))
  // Coin count: enough to densely fill the mound (overlap = depth illusion)
  const moundArea    = baseSpreadPx * peakPx
  const avgCoinArea  = ((sizeMin + sizeMax) / 2) ** 2
  const count        = Math.round(Math.min(320, Math.max(90, (moundArea * 7.5) / avgCoinArea)))
  // Sparkles + rain spread also scale
  const sparkleCount = Math.round(Math.min(80, Math.max(25, (vw * vh) / 26000)))
  const rainSpreadPx = Math.max(320, Math.min(900, vw * 0.45))

  return { vw, vh, baseSpreadPx, peakPx, sizeMin, sizeMax, count, sparkleCount, rainSpreadPx }
}

interface Coin {
  id: number
  left: number       // % from left where it lands
  delay: number
  duration: number
  size: number
  rotate: number     // Z-rotation during fall (spin)
  endBottom: number  // px from viewport bottom where this coin lands (pile height)
  driftX: number     // horizontal drift in px while falling
  // Final 3D pose (after landing) — gives coins a tilted, dimensional look
  tiltX: number      // rotateX (tilt forward/back)
  tiltY: number      // rotateY (tilt left/right)
  tiltZ: number      // rotateZ (in-plane spin) at rest
  zIndex: number     // stacking: foreground coins (low endBottom) on top
  startOffsetX: number  // px from center where the coin spawns (rain spreads wide)
}

// Suspense wrapper required because KidHomePageInner uses useSearchParams()
export default function KidHomePage() {
  return (
    <Suspense fallback={null}>
      <KidHomePageInner />
    </Suspense>
  )
}

function KidHomePageInner() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<'rain' | 'coin' | 'store' | 'history' | 'rules'>('rain')
  const [balance, setBalance] = useState(0)
  const [kidName, setKidName] = useState('')
  const [rewards, setRewards] = useState<RewardCatalog[]>([])
  const [coins, setCoins] = useState<Coin[]>([])
  const [sparkles, setSparkles] = useState<{ id: number; left: number; top: number; delay: number; duration: number; size: number }[]>([])
  const [pilePeak, setPilePeak] = useState(180)   // used to size the bottom padding so buttons clear the pile
  const [bigCoinSize, setBigCoinSize] = useState(300)

  // Generate the coin pile + sparkles using actual viewport size, and regenerate on resize
  useEffect(() => {
    const generate = () => {
      const p = computePileParams()
      setPilePeak(p.peakPx)
      // Big coin scales to fit remaining vertical space above the pile (and not exceed viewport width).
      // Floor at 200px so a 6-digit number like 100000 remains comfortably readable.
      // Reserved heights: pt-12=48, bottom-pad=peak+70, greeting≈32, bottom buttons≈86, button hint+gap≈36
      const availableV = p.vh - 48 - (p.peakPx + 70) - 32 - 86 - 36
      const bigSize = Math.min(360, p.vw * 0.55, Math.max(200, availableV))
      setBigCoinSize(bigSize)

      const arr: Coin[] = Array.from({ length: p.count }, (_, i) => {
        // Pick a height in the mound: bias toward the base (more coins at bottom than at peak)
        const heightFrac = Math.pow(Math.random(), 0.55)
        // Mound is widest at base, narrows to a point at the peak (cone profile)
        const widthAtHeight = p.baseSpreadPx * (1 - heightFrac * 0.85)
        const offsetPx = randomBetween(-widthAtHeight, widthAtHeight)
        // Pile height in px above floor
        const endBottom = Math.max(0, heightFrac * p.peakPx + randomBetween(-8, 8))
        // ~75% of coins lie flat (tilted view → ellipses → reads as 3D mound)
        const isFlat = Math.random() < 0.75
        const size = randomBetween(p.sizeMin, p.sizeMax)
        return {
          id: i,
          left: 50,
          delay: randomBetween(0, 2.6),
          duration: randomBetween(1.4, 2.8),
          size,
          rotate: randomBetween(-180, 180),
          endBottom,
          driftX: offsetPx,
          tiltX: isFlat ? randomBetween(58, 82) : randomBetween(0, 30),
          tiltY: randomBetween(-25, 25),
          tiltZ: randomBetween(-180, 180),
          zIndex: 0,
          startOffsetX: randomBetween(-p.rainSpreadPx, p.rainSpreadPx),
        }
      })
      // Render back-to-front: high endBottom first, low last (front of pile drawn last)
      arr.sort((a, b) => b.endBottom - a.endBottom)
      arr.forEach((c, i) => { c.zIndex = i })
      setCoins(arr)

      const sp = Array.from({ length: p.sparkleCount }, (_, i) => ({
        id: i,
        left: randomBetween(0, 100),
        top: randomBetween(0, 100),
        delay: randomBetween(0, 3),
        duration: randomBetween(1.2, 2.4),
        size: randomBetween(4, 12),
      }))
      setSparkles(sp)
    }
    generate()

    // Debounced regenerate on resize so the mound adapts to window size changes
    let timer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(generate, 250)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (timer) clearTimeout(timer)
    }
  }, [])
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [childId, setChildId] = useState('')
  // Show daily bonus celebration if the login page passed ?bonus=1
  const [dailyBonus, setDailyBonus] = useState(() => searchParams.get('bonus') === '1')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profile }, { data: childRecord }] = await Promise.all([
        supabase.from('profiles').select('name').eq('id', user.id).single(),
        supabase.from('children').select('id').eq('user_id', user.id).single(),
      ])

      if (profile) setKidName(profile.name)
      if (childRecord) {
        setChildId(childRecord.id)

        const { data: bal } = await supabase.rpc('get_token_balance', { p_kid_id: childRecord.id })
        setBalance(bal || 0)
      }

      const stored: string[] = JSON.parse(localStorage.getItem('reward_sort_order') || '[]')
      const { data: rewardData } = await supabase.from('reward_catalog').select('*').eq('active', true)
      if (rewardData) {
        if (stored.length) {
          const map = Object.fromEntries(rewardData.map(r => [r.id, r]))
          const ordered = stored.filter(id => map[id]).map(id => map[id])
          const rest = rewardData.filter(r => !stored.includes(r.id))
          setRewards([...ordered, ...rest])
        } else {
          setRewards(rewardData)
        }
      }
    }
    load()

    // Rain duration: more coins, longer show
    const t = setTimeout(() => setPhase('coin'), 5200)
    return () => clearTimeout(t)
  }, [])

  const handleRedeem = async (reward: RewardCatalog) => {
    if (redeeming) return
    if (balance < reward.token_cost) {
      setMessage('❌ Token 不足，继续加油！')
      setTimeout(() => setMessage(''), 2500)
      return
    }
    setRedeeming(reward.id)
    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reward_id: reward.id }),
    })
    const data = await res.json()
    setRedeeming(null)
    if (res.ok) {
      setBalance(b => b - reward.token_cost)
      setMessage(`🎉 成功兑换「${reward.title}」！等家长确认哦～`)
      setTimeout(() => setMessage(''), 3500)
    } else {
      setMessage('❌ ' + data.error)
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/kid/login'
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-900 via-purple-900 to-violet-950 select-none">

      {/* ── Ambient golden glow (always-on background lighting) ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Top spotlight */}
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[140vw] h-[80vh] rounded-full blur-3xl opacity-60"
          style={{ background: 'radial-gradient(closest-side, rgba(255,200,60,0.55), rgba(255,150,30,0.15) 55%, transparent 75%)' }}
        />
        {/* Side warm lights */}
        <div
          className="absolute top-1/4 -left-32 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-40"
          style={{ background: 'radial-gradient(closest-side, rgba(255,180,100,0.5), transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 -right-32 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-35"
          style={{ background: 'radial-gradient(closest-side, rgba(255,160,80,0.45), transparent 70%)' }}
        />
        {/* Light beams */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-[200%] h-[120%] opacity-30 mix-blend-screen"
          style={{
            background:
              'conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(255,215,0,0.35) 18deg, transparent 36deg, transparent 72deg, rgba(255,215,0,0.25) 90deg, transparent 108deg, transparent 144deg, rgba(255,215,0,0.3) 162deg, transparent 180deg)',
          }}
        />
      </div>

      {/* ── COIN RAIN + PILE (always rendered so pile persists across phases) ── */}
      <div className="pointer-events-none absolute inset-0 z-[5]" style={{ perspective: '1200px' }}>
        {/* Ground glow — concentrated golden halo under the pile mound */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[420px] rounded-[50%] blur-3xl opacity-80"
          style={{ background: 'radial-gradient(closest-side, rgba(255,220,80,0.7), rgba(255,180,40,0.35) 45%, transparent 75%)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-56"
          style={{
            background:
              'linear-gradient(to top, rgba(255,200,40,0.4) 0%, rgba(255,180,40,0.2) 40%, transparent 100%)',
            filter: 'blur(4px)',
          }}
        />

        {/* Light rays from above onto the pile */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[100vh] opacity-25 mix-blend-screen"
          style={{
            background:
              'conic-gradient(from 200deg at 50% -10%, transparent 0deg, rgba(255,235,150,0.55) 14deg, transparent 28deg, transparent 56deg, rgba(255,235,150,0.4) 70deg, transparent 84deg, transparent 112deg, rgba(255,235,150,0.5) 126deg, transparent 140deg)',
          }}
        />

        {/* Falling coins (animation-fill-mode: both keeps them hidden during delay & piled at end) */}
        {coins.map(coin => (
          <span
            key={coin.id}
            className="absolute animate-coin-fall"
            style={{
              left: `calc(50% - ${coin.size / 2}px)`,  // anchor coin's center at horizontal 50%
              top: 0,
              willChange: 'transform',
              animationDelay: `${coin.delay}s`,
              animationDuration: `${coin.duration}s`,
              animationFillMode: 'both',
              zIndex: coin.zIndex,
              transformStyle: 'preserve-3d',
              ['--ey' as string]: `calc(100vh - ${coin.size + coin.endBottom}px)`,
              ['--dx' as string]: `${coin.driftX}px`,
              ['--sx' as string]: `${coin.startOffsetX}px`,
              ['--start-y' as string]: `-${coin.size + 80}px`,
              ['--r' as string]: `${coin.rotate}deg`,
              ['--tx' as string]: `${coin.tiltX}deg`,
              ['--ty' as string]: `${coin.tiltY}deg`,
              ['--tz' as string]: `${coin.tiltZ}deg`,
            } as React.CSSProperties}
          >
            {/* 3D pose wrapper: settles into the final tilted orientation, gives mound depth */}
            <span
              className="block animate-coin-pose"
              style={{
                transformStyle: 'preserve-3d',
                animationDelay: `${coin.delay}s`,
                animationDuration: `${coin.duration}s`,
                animationFillMode: 'both',
                filter: 'drop-shadow(0 6px 4px rgba(80,40,0,0.55)) drop-shadow(0 0 6px rgba(255,210,80,0.5))',
              }}
            >
              <GoldCoin size={coin.size} />
            </span>
          </span>
        ))}
      </div>

      {/* ── PHASE: RAIN (greeting + sparkles only — coins handled above) ── */}
      {phase === 'rain' && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Twinkling sparkles */}
          {sparkles.map(sp => (
            <span
              key={`sp-${sp.id}`}
              className="absolute rounded-full animate-sparkle"
              style={{
                left: `${sp.left}%`,
                top: `${sp.top}%`,
                width: sp.size,
                height: sp.size,
                background: 'radial-gradient(circle, #FFFDE7 0%, #FFD700 45%, transparent 70%)',
                boxShadow: '0 0 12px 2px rgba(255,215,0,0.8)',
                animationDelay: `${sp.delay}s`,
                animationDuration: `${sp.duration}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <p
              className="text-3xl font-black animate-pulse"
              style={{
                color: '#FFF8DC',
                textShadow: '0 0 24px rgba(255,215,0,0.9), 0 0 48px rgba(255,180,40,0.6), 0 2px 4px rgba(0,0,0,0.4)',
              }}
            >
              你好，{kidName || '…'}！
            </p>
          </div>
        </div>
      )}

      {/* ── PHASE: BIG COIN ── */}
      {phase === 'coin' && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center pt-12"
          style={{ paddingBottom: pilePeak + 70 }}   // clear the pile + breathing room above mound peak
        >
          {/* Top: greeting */}
          <p
            className="text-2xl font-bold drop-shadow-lg relative z-10"
            style={{
              color: '#FFF8DC',
              textShadow: '0 0 24px rgba(0,0,0,0.6), 0 0 12px rgba(255,215,0,0.6), 0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            你好，{kidName}！
          </p>

          {/* Middle: big coin (centered in remaining space) */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <button
              onClick={() => setPhase('store')}
              className="relative flex flex-col items-center animate-coin-appear hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="relative" style={{ filter: 'drop-shadow(0 0 40px rgba(255,215,0,0.8))' }}>
                <GoldCoin size={bigCoinSize} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-black drop-shadow-lg tabular-nums tracking-tight"
                    style={{
                      color: '#3E1A00',
                      textShadow: '0 1px 3px rgba(255,215,0,0.6)',
                      // Font sized so the digits always fit inside the coin face (face ≈ 82% of diameter).
                      // 6-digit (e.g. 100000) is the design target.
                      fontSize: bigCoinSize * (
                        balance >= 1000000 ? 0.18 :   // 7 digits
                        balance >= 100000  ? 0.22 :   // 6 digits — design target
                        balance >= 10000   ? 0.30 :   // 5 digits
                        balance >= 1000    ? 0.36 :   // 4 digits
                                             0.46     // 1–3 digits
                      ),
                      lineHeight: 1,
                    }}
                  >
                    {balance}
                  </span>
                </div>
              </div>
              <span className="text-yellow-200 text-sm mt-3 animate-bounce drop-shadow font-semibold">点击兑换奖品 ✨</span>
            </button>
          </div>

          {/* Bottom: action buttons + sign out (above pile) */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-4">
              <button onClick={() => setPhase('rules')}
                className="px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-base font-medium rounded-2xl backdrop-blur transition-all active:scale-95">
                ⭐ 挣金币
              </button>
              <button onClick={() => setPhase('history')}
                className="px-5 py-2.5 bg-white/15 hover:bg-white/25 text-white text-base font-medium rounded-2xl backdrop-blur transition-all active:scale-95">
                📋 历史记录
              </button>
            </div>
            <button onClick={signOut} className="text-purple-300/70 text-xs hover:text-purple-200 transition-colors">退出登录</button>
          </div>
        </div>
      )}

      {/* ── PHASE: STORE ── */}
      {phase === 'store' && (
        <div
          className="absolute inset-0 z-20 flex flex-col animate-slide-up overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #FFF0FA 0%, #FFE4C8 35%, #D6F0FF 70%, #EDE0FF 100%)',
          }}
        >
          {/* Vivid ambient glows */}
          <div className="pointer-events-none absolute -top-40 -left-32 w-[80vw] h-[80vw] rounded-full blur-3xl opacity-80"
            style={{ background: 'radial-gradient(closest-side, #FFD580 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none absolute -top-20 -right-20 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-70"
            style={{ background: 'radial-gradient(closest-side, #FF85C1 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-[70vw] h-[70vw] rounded-full blur-3xl opacity-65"
            style={{ background: 'radial-gradient(closest-side, #6BE6FF 0%, transparent 70%)' }}
          />
          <div className="pointer-events-none absolute bottom-8 right-0 w-[50vw] h-[50vw] rounded-full blur-3xl opacity-55"
            style={{ background: 'radial-gradient(closest-side, #C5A6FF 0%, transparent 70%)' }}
          />
          {/* Confetti dot pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle, #FF6B9D 1.5px, transparent 2px), radial-gradient(circle, #FFA500 1.5px, transparent 2px), radial-gradient(circle, #4FC3F7 1.5px, transparent 2px), radial-gradient(circle, #9B6EFF 1.5px, transparent 2px)',
              backgroundSize: '100px 100px, 80px 80px, 110px 110px, 70px 70px',
              backgroundPosition: '0 0, 40px 55px, 20px 80px, 65px 20px',
            }}
          />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-4 pt-8 pb-3">
            <button
              onClick={() => setPhase('coin')}
              className="w-11 h-11 rounded-full bg-white text-[#FF6B9D] text-2xl flex items-center justify-center transition-all active:scale-90 border-2 border-white/80"
              aria-label="返回"
              style={{ boxShadow: '0 4px 14px rgba(255,107,157,0.35)' }}
            >
              ←
            </button>
            <h1 className="font-black text-2xl tracking-wide flex items-center gap-1.5"
              style={{ color: '#5B2E91', textShadow: '0 2px 0 rgba(255,255,255,0.8)' }}
            >
              <span>🛍️</span><span>奖品商店</span>
            </h1>
            {/* Balance pill */}
            <div className="flex items-center gap-1 pl-1.5 pr-3 py-1.5 rounded-full font-black text-sm border-2 border-white"
              style={{
                background: 'linear-gradient(135deg, #FFE048 0%, #FF9800 100%)',
                color: '#4A1F00',
                boxShadow: '0 4px 14px rgba(255,152,0,0.55)',
              }}
            >
              <GoldCoin size={20} />
              <span className="tabular-nums">{balance}</span>
            </div>
          </div>

          {message && (
            <div className="relative z-10 mx-4 mb-2 rounded-2xl px-4 py-3 text-center text-sm font-bold shadow-xl border-2 border-white"
              style={{ background: 'linear-gradient(135deg, #FFF, #FFF8F0)', color: '#5B2E91' }}
            >
              {message}
            </div>
          )}

          {/* Grid */}
          <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-8">
            <div className="w-full max-w-5xl mx-auto pt-1 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {rewards.map((reward, idx) => {
                const affordable = balance >= reward.token_cost
                const isRedeeming = redeeming === reward.id
                // Per-card accent — pastel footer bar so each card has colour identity
                // without tainting the product image (white image area keeps colours true).
                const accents = [
                  { ring: '#FF3B82', bar: 'linear-gradient(135deg, #FFECF3 0%, #FFD6E8 100%)' },  // rose
                  { ring: '#0096C7', bar: 'linear-gradient(135deg, #E8F6FF 0%, #C4E9FF 100%)' },  // sky blue
                  { ring: '#FF6600', bar: 'linear-gradient(135deg, #FFF3E6 0%, #FFE0B8 100%)' },  // orange
                  { ring: '#9B27D4', bar: 'linear-gradient(135deg, #F5EEFF 0%, #E8D4FF 100%)' },  // purple
                  { ring: '#00A854', bar: 'linear-gradient(135deg, #EAFFF4 0%, #C4F0D8 100%)' },  // green
                  { ring: '#D4A000', bar: 'linear-gradient(135deg, #FFFBE6 0%, #FFF0A0 100%)' },  // golden
                ]
                const accent = accents[idx % accents.length]
                return (
                  <button
                    key={reward.id}
                    onClick={() => handleRedeem(reward)}
                    disabled={!!redeeming}
                    className={`group relative flex flex-col rounded-3xl overflow-hidden text-left transition-all duration-200
                      ${affordable ? 'hover:-translate-y-2 active:scale-[0.96] cursor-pointer' : 'cursor-default'}
                      ${isRedeeming ? 'animate-pulse' : ''}`}
                    style={{
                      boxShadow: affordable
                        ? `0 8px 28px ${accent.ring}44, 0 0 0 3px ${accent.ring}`
                        : '0 4px 16px rgba(0,0,0,0.07), 0 0 0 2px #DDD4EE',
                    }}
                  >
                    {/* ── Square image area — pure white so product colours are never tinted ──
                        object-contain always shows the full product (no cropping).
                        Wide products (car, iPad) fill the width; tall products (phone) fill the height.
                        White product backgrounds merge invisibly into the white container. */}
                    <div className="relative aspect-square bg-white flex items-center justify-center overflow-hidden">
                      {reward.image_url ? (
                        <img
                          src={reward.image_url}
                          alt={reward.title}
                          // Images are pre-processed: background removed, whitespace cropped.
                          // object-contain shows the full product at maximum size.
                          // drop-shadow lifts the product off the white background visually.
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110"
                          style={{
                            padding: '6%',
                            filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.22)) saturate(1.15) contrast(1.05)',
                          }}
                        />
                      ) : (
                        <span className="text-7xl transition-transform duration-300 group-hover:scale-110">🎁</span>
                      )}
                      {/* Sparkle badge for affordable */}
                      {affordable && (
                        <span className="absolute top-2 right-2 text-lg leading-none animate-bounce select-none">✨</span>
                      )}
                    </div>

                    {/* ── Coloured info bar — accent pastel gives each card its visual identity ── */}
                    <div
                      className="px-3 pt-2 pb-2.5 flex flex-col gap-1 flex-shrink-0"
                      style={{ background: accent.bar }}
                    >
                      <p className="font-extrabold text-sm leading-snug truncate"
                        style={{ color: '#2D1050' }}>
                        {reward.title}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <GoldCoin size={15} />
                          <span className="font-black text-base tabular-nums leading-none"
                            style={{ color: '#C05800' }}>
                            {reward.token_cost}
                          </span>
                        </div>
                        {isRedeeming ? (
                          <span className="text-[11px] font-bold text-amber-700 px-2 py-0.5 bg-white/70 rounded-full flex-shrink-0">兑换中…</span>
                        ) : affordable ? (
                          <span
                            className="text-[11px] font-black px-3 py-1.5 rounded-full text-white flex-shrink-0 whitespace-nowrap transition-transform group-hover:scale-110"
                            style={{
                              background: `linear-gradient(135deg, ${accent.ring} 0%, ${accent.ring}cc 100%)`,
                              boxShadow: `0 3px 10px ${accent.ring}55`,
                            }}
                          >
                            兑换 ✨
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap bg-white/60"
                            style={{ color: '#7040B0' }}>
                            差{reward.token_cost - balance}枚
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
              {rewards.length === 0 && (
                <div className="col-span-full text-center py-16 font-bold" style={{ color: '#9267CC' }}>还没有奖品哦～</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PHASE: HISTORY ── */}
      {phase === 'history' && (
        <div className="absolute inset-0 z-20 flex flex-col animate-slide-up bg-gradient-to-b from-indigo-900/90 via-purple-900/95 to-violet-950">
          <div className="flex items-center justify-between px-4 pt-10 pb-4">
            <button onClick={() => setPhase('coin')} className="text-white/80 hover:text-white text-2xl">←</button>
            <h1 className="text-white font-bold text-xl">📋 历史记录</h1>
            <div className="w-8" />
          </div>
          <HistoryList childId={childId} />
        </div>
      )}

      {/* ── DAILY LOGIN BONUS ── */}
      {dailyBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto px-6 py-5 rounded-3xl shadow-2xl flex flex-col items-center gap-3 animate-bonus-in"
            style={{
              background: 'linear-gradient(135deg, #FFE066 0%, #FF9500 60%, #FF6B00 100%)',
              boxShadow: '0 20px 60px -10px rgba(255,140,0,0.6), 0 0 80px rgba(255,200,40,0.4)',
              border: '3px solid #FFFAE0',
            }}
          >
            {/* Spinning coin */}
            <div className="animate-bonus-spin" style={{ filter: 'drop-shadow(0 4px 12px rgba(255,140,0,0.6))' }}>
              <GoldCoin size={80} />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-xl tracking-wide drop-shadow" style={{ textShadow: '0 2px 6px rgba(120,40,0,0.5)' }}>
                每日登录奖励
              </p>
              <p className="text-amber-50 font-black text-2xl mt-1 tabular-nums" style={{ textShadow: '0 2px 6px rgba(120,40,0,0.6)' }}>
                +1 金币 ✨
              </p>
            </div>
            <button
              onClick={() => setDailyBonus(false)}
              className="mt-1 px-6 py-1.5 bg-white/90 hover:bg-white text-[#B85200] text-sm font-black rounded-full active:scale-95 transition-transform"
            >
              收下
            </button>
          </div>
        </div>
      )}

      {/* ── PHASE: RULES ── */}
      {phase === 'rules' && (
        <div className="absolute inset-0 z-20 flex flex-col animate-slide-up bg-gradient-to-b from-indigo-900/90 via-purple-900/95 to-violet-950">
          <div className="flex items-center justify-between px-4 pt-10 pb-4">
            <button onClick={() => setPhase('coin')} className="text-white/80 hover:text-white text-2xl">←</button>
            <h1 className="text-white font-bold text-xl">⭐ 怎么挣金币</h1>
            <div className="w-8" />
          </div>
          <RulesList />
        </div>
      )}

      <style jsx global>{`
        @keyframes coinFall {
          0%   { transform: translate(var(--sx, 0), var(--start-y, -150px)); opacity: 0; }
          8%   { opacity: 1; }
          90%  { transform: translate(var(--dx, 0), calc(var(--ey, 90vh) - 18px)); }
          96%  { transform: translate(var(--dx, 0), var(--ey, 90vh)); }
          100% { transform: translate(var(--dx, 0), var(--ey, 90vh)); opacity: 1; }
        }
        .animate-coin-fall {
          animation-name: coinFall;
          animation-timing-function: cubic-bezier(.4, 0, .6, 1);
        }
        @keyframes coinPose {
          0%   { transform: rotateZ(0deg); }
          70%  { transform: rotateZ(var(--r, 360deg)); }
          90%  { transform: rotateX(calc(var(--tx, 0deg) * 0.5)) rotateY(calc(var(--ty, 0deg) * 0.5)) rotateZ(var(--tz, 0deg)); }
          100% { transform: rotateX(var(--tx, 0deg)) rotateY(var(--ty, 0deg)) rotateZ(var(--tz, 0deg)); }
        }
        .animate-coin-pose {
          animation-name: coinPose;
          animation-timing-function: cubic-bezier(.4, 0, .3, 1.2);
        }
        @keyframes coinAppear {
          from { opacity: 0; transform: scale(0.3); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-coin-appear {
          animation: coinAppear 0.6s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.4s ease-out forwards;
        }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        .animate-sparkle {
          animation-name: sparkleTwinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        @keyframes bonusIn {
          0%   { opacity: 0; transform: scale(0.3) rotate(-12deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        .animate-bonus-in {
          animation: bonusIn 0.55s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        @keyframes bonusSpin {
          0%   { transform: rotateY(0deg) scale(1); }
          50%  { transform: rotateY(180deg) scale(1.1); }
          100% { transform: rotateY(360deg) scale(1); }
        }
        .animate-bonus-spin {
          animation: bonusSpin 1.6s ease-in-out infinite;
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  )
}

function HistoryList({ childId }: { childId: string }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!childId) return
    const supabase = createClient()
    supabase
      .from('token_ledger')
      .select('*, behavior_rules(title)')
      .eq('child_id', childId)
      .order('occurred_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setEntries(data || []); setLoading(false) })
  }, [childId])

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">加载中…</div>

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="max-w-md mx-auto px-6 space-y-3">
        {entries.length === 0 && (
          <div className="text-center text-white/70 py-12">还没有记录</div>
        )}
        {entries.map(e => {
          const isEarn = e.entry_type === 'earn'
          return (
            <div key={e.id} className="bg-white/15 backdrop-blur rounded-2xl px-4 py-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-2xl
                ${isEarn ? 'bg-yellow-400/20' : 'bg-white/10'}`}>
                {isEarn ? '⭐' : '🎁'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base">
                  {e.behavior_rules?.title ?? (e.entry_type === 'redeem' ? '兑换奖品' : '手动调整')}
                </p>
                <p className="text-white/50 text-sm mt-0.5">
                  {new Date(e.occurred_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={`font-black text-xl ${isEarn ? 'text-yellow-300' : 'text-white/50'}`}>
                  {isEarn ? '+' : '-'}{e.token_amount}
                </span>
                <p className={`text-xs ${isEarn ? 'text-yellow-300/60' : 'text-white/30'}`}>金币</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RulesList() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('behavior_rules')
      .select('*')
      .eq('active', true)
      .order('token_value', { ascending: false })
      .then(({ data }) => { setRules(data || []); setLoading(false) })
  }, [])

  if (loading) return <div className="flex-1 flex items-center justify-center text-white">加载中…</div>

  return (
    <div className="flex-1 overflow-y-auto pb-6">
      <div className="max-w-md mx-auto px-6 space-y-3">
      {rules.length === 0 && (
        <div className="text-center text-white/70 py-12">暂无行为规则</div>
      )}
      {rules.map(rule => (
        <div key={rule.id} className="bg-white/15 backdrop-blur rounded-2xl px-4 py-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
            <GoldCoin size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-base">{rule.title}</p>
            {rule.description && (
              <p className="text-white/60 text-xs mt-0.5">{rule.description}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-yellow-300 font-black text-xl">+{rule.token_value}</span>
            <p className="text-yellow-300/60 text-xs">金币</p>
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}
