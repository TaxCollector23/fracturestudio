import { AlertTriangle, CheckCircle2, MessageSquare, Shield, Swords } from 'lucide-react';

export type DebateDrillPriority = 'low' | 'medium' | 'high';

export type DebateDrillCard = {
  id: string;
  opponentClaim: string;
  opponentMove: string;
  response: string;
  crossfireQuestion: string;
  risk: string;
  priority?: DebateDrillPriority;
  drilled?: boolean;
};

export type DebateDrillPanelProps = {
  cards: DebateDrillCard[];
  activeCardId?: string;
  personaLabel?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
  onCardSelect?: (card: DebateDrillCard) => void;
  onMarkDrilled?: (card: DebateDrillCard) => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function priorityTone(priority: DebateDrillPriority | undefined): string {
  if (priority === 'high') {
    return 'border-rose-900/70 bg-rose-950/25 text-rose-200';
  }
  if (priority === 'medium') {
    return 'border-amber-900/70 bg-amber-950/25 text-amber-200';
  }
  if (priority === 'low') {
    return 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200';
  }
  return 'border-zinc-800 bg-zinc-950 text-zinc-400';
}

export function DebateDrillPanel({
  cards,
  activeCardId,
  personaLabel = 'Opponent simulator',
  heading = 'Debate drill',
  ariaLabel = 'Debate drill panel',
  className = '',
  onCardSelect,
  onMarkDrilled,
}: DebateDrillPanelProps) {
  const activeCard = cards.find((card) => card.id === activeCardId) ?? cards[0];

  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">{personaLabel}</p>
        </div>
        <Swords className="h-5 w-5 text-zinc-400" aria-hidden="true" />
      </div>

      {cards.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-zinc-400">No debate drill cards have been generated for this case.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-2" role="list" aria-label="Debate drill cards">
            {cards.map((card, index) => {
              const selected = card.id === activeCard?.id;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-zinc-500">Card {index + 1}</span>
                    {card.drilled ? <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-label="Drilled" /> : <AlertTriangle className="h-4 w-4 text-zinc-600" aria-hidden="true" />}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-300">{card.opponentClaim}</p>
                  <span className={cx('mt-3 inline-flex border px-2 py-1 text-[10px] uppercase tracking-wider', priorityTone(card.priority))}>
                    {card.priority ?? 'medium'} priority
                  </span>
                </>
              );

              return onCardSelect ? (
                <button
                  aria-pressed={selected}
                  aria-label={`Open debate drill card ${index + 1}`}
                  className={cx(
                    'border p-3 text-left transition-colors',
                    selected ? 'border-zinc-500 bg-zinc-900/80' : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-700',
                  )}
                  key={card.id}
                  onClick={() => onCardSelect(card)}
                  role="listitem"
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <article className={cx('border border-zinc-900 bg-zinc-950/60 p-3', selected && 'border-zinc-500 bg-zinc-900/80')} key={card.id} role="listitem">
                  {content}
                </article>
              );
            })}
          </div>

          {activeCard && (
            <article className="border border-zinc-900 bg-zinc-950/60 p-4" aria-label="Selected debate drill card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Opponent claim</p>
                  <h3 className="mt-2 text-base font-medium leading-7 text-zinc-100">{activeCard.opponentClaim}</h3>
                </div>
                {onMarkDrilled && (
                  <button
                    aria-label={`Mark debate drill card as drilled: ${activeCard.opponentClaim}`}
                    className="flex h-9 w-9 items-center justify-center border border-zinc-800 text-zinc-300 transition-colors hover:border-emerald-700 hover:text-emerald-200"
                    onClick={() => onMarkDrilled(activeCard)}
                    type="button"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-3">
                <div className="border border-zinc-900 bg-[#09090b] p-3">
                  <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    If they say
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{activeCard.opponentMove}</p>
                </div>
                <div className="border border-zinc-900 bg-[#09090b] p-3">
                  <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    You answer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{activeCard.response}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="border border-zinc-900 bg-[#09090b] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Crossfire question</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{activeCard.crossfireQuestion}</p>
                  </div>
                  <div className="border border-zinc-900 bg-[#09090b] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Response risk</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{activeCard.risk}</p>
                  </div>
                </div>
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
