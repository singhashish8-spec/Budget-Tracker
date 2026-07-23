import { colors } from '../theme/tokens';

// Shown while the local database opens. Mirrors the Home layout — header, hero,
// and a couple of list cards — so the app feels like it's arriving rather than
// hanging on a spinner. Purely presentational; the shimmer is a CSS effect that
// stills itself when motion is reduced.
function Bar({ w, h = 12, style }) {
  return <div className="skl" style={{ width: w, height: h, ...style }} />;
}

function Row() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div className="skl" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bar w="55%" />
        <Bar w="35%" h={10} />
      </div>
      <Bar w={54} />
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {children}
    </div>
  );
}

export default function SkeletonHome() {
  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: colors.bgApp }}>
      <div style={{ flex: 1, padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bar w={110} h={20} />
          <Bar w={80} h={11} />
        </div>

        {/* Hero */}
        <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.6 }}>
          <div className="skl" style={{ width: '40%', height: 11 }} />
          <div className="skl" style={{ width: '55%', height: 30 }} />
          <div className="skl" style={{ width: '100%', height: 6, borderRadius: 100 }} />
        </div>

        <Card>
          <Bar w="45%" h={15} />
          <Row />
          <Row />
          <Row />
        </Card>

        <Card>
          <Bar w="40%" h={15} />
          <Row />
          <Row />
        </Card>
      </div>
    </div>
  );
}
