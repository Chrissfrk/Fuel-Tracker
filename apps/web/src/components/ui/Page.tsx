import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { hueVar, SECTION_HUE } from '../../lib/palette';
import { Icon } from './Icon';

interface PageProps {
  title: string;
  /** Large title that collapses into the bar on scroll (top-level tabs). */
  large?: boolean;
  /** Back button label + target, for pushed screens. */
  back?: { label: string; to?: string };
  trailing?: ReactNode;
  /** Rendered under the large title (e.g. car switcher). */
  accessory?: ReactNode;
  /** Replace the large title text with a custom node (e.g. a car switcher button). */
  titleNode?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Ambient colour behind the title. Defaults to the section's hue. */
  tint?: string;
}

function useSectionTint(): string {
  const { pathname } = useLocation();
  const hit = SECTION_HUE.find(([prefix]) => pathname.startsWith(prefix));
  return hueVar(hit?.[1] ?? 'blue');
}

export function Page({
  title,
  large,
  back,
  trailing,
  accessory,
  titleNode,
  children,
  wide,
  tint,
}: PageProps) {
  const sectionTint = useSectionTint();
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e!.isIntersecting), {
      rootMargin: `-${44}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.title = `${title} · Fuel`;
  }, [title]);

  const showSmallTitle = !large || scrolled;

  return (
    <div className="fade-in relative isolate">
      <div
        aria-hidden
        className="page-glow"
        style={{ '--glow': tint ?? sectionTint, '--glow-2': 'var(--accent)' } as CSSProperties}
      />
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-200 ${
          scrolled ? 'material-bar' : 'bg-transparent'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: scrolled ? '0 0.5px 0 var(--bar-edge)' : 'none',
        }}
      >
        <div
          className={`mx-auto grid h-11 grid-cols-[1fr_auto_1fr] items-center px-2 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
        >
          <div className="flex min-w-0 items-center">
            {back && (
              <button
                type="button"
                onClick={() => (back.to ? navigate(back.to) : navigate(-1))}
                className="pressable -ml-1 flex h-11 min-w-11 items-center gap-0.5 pr-2 text-accent-text"
              >
                <Icon name="chevronLeft" size={26} strokeWidth={2.4} />
                <span className="truncate text-body">{back.label}</span>
              </button>
            )}
          </div>
          <h1
            className={`truncate text-center text-headline transition-opacity duration-200 ${
              showSmallTitle ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={large ? true : undefined}
          >
            {title}
          </h1>
          <div className="flex items-center justify-end gap-1">{trailing}</div>
        </div>
      </header>

      <main
        className={`mx-auto px-4 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 44px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        {large && (
          <div className="pt-1 pb-2">
            {titleNode ?? <h1 className="text-large-title">{title}</h1>}
            {accessory}
          </div>
        )}
        <div ref={sentinel} aria-hidden className="h-px" />
        {children}
      </main>
    </div>
  );
}

export function BarButton({
  children,
  onClick,
  label,
  disabled,
  bold,
}: {
  children: ReactNode;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  bold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`pressable flex h-11 min-w-11 items-center justify-center px-2 text-accent-text disabled:opacity-40 ${
        bold ? 'font-semibold' : ''
      }`}
    >
      {children}
    </button>
  );
}
