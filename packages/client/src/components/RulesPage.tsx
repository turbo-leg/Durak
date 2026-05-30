import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { colors, gradients, shadows, radii, fonts } from '../theme';

function RuleCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: gradients.panel,
        border: '1px solid rgba(212,175,55,0.18)',
        borderRadius: radii.md,
        padding: '14px 16px',
        boxShadow: shadows.engrave,
        fontSize: 13,
        lineHeight: 1.7,
        color: colors.ivory[200],
      }}
    >
      {children}
    </div>
  );
}

function RuleList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: '8px 0 0',
        paddingLeft: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {items.map((item, i) => (
        <li key={i} style={{ color: colors.ivory[200], fontSize: 13, lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: gradients.gold,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.display,
          fontWeight: 900,
          fontSize: 12,
          color: colors.ink[900],
          flexShrink: 0,
          boxShadow: shadows.goldGlow,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 13, color: colors.ivory[200], lineHeight: 1.65, paddingTop: 3 }}>
        {text}
      </div>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontWeight: 700,
        color: colors.gold[300],
        fontFamily: fonts.display,
        letterSpacing: 1,
      }}
    >
      {label}
    </p>
  );
}

function AccordionItem({
  id,
  icon,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: radii.md,
        overflow: 'hidden',
        border: `1px solid ${isOpen ? 'rgba(212,175,55,0.4)' : 'rgba(212,175,55,0.15)'}`,
        boxShadow: isOpen ? shadows.goldGlow : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: isOpen
            ? 'linear-gradient(180deg, rgba(13,70,48,0.9), rgba(7,38,26,0.95))'
            : gradients.panel,
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: isOpen ? colors.gold[300] : colors.ivory[100],
            flex: 1,
          }}
        >
          {title}
        </span>
        <span
          style={{
            color: colors.gold[400],
            fontSize: 18,
            transition: 'transform 0.25s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'block',
          }}
        >
          ›
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '0 12px 14px',
                background: 'rgba(4,21,14,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const RulesPage: React.FC = () => {
  const { t } = useTranslation('rules');
  const [openId, setOpenId] = useState<string>('objective');
  const toggle = (id: string) => setOpenId(openId === id ? '' : id);

  const sections = [
    {
      id: 'objective',
      icon: '🎯',
      title: t('sections.objective'),
      content: (
        <RuleCard>
          <p style={{ margin: 0 }}>{t('objective.p1')}</p>
          <p style={{ margin: '10px 0 0' }}>{t('objective.p2')}</p>
        </RuleCard>
      ),
    },
    {
      id: 'deck',
      icon: '🃏',
      title: t('sections.deck'),
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RuleCard>
            <p style={{ margin: 0 }}>{t('deck.p1')}</p>
            <p style={{ margin: '8px 0 0' }}>{t('deck.p2')}</p>
          </RuleCard>
          <RuleCard>
            <SectionTitle label={t('deck.rankOrder')} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].map((r) => (
                <div
                  key={r}
                  style={{
                    width: 36,
                    height: 50,
                    background: gradients.card,
                    borderRadius: 6,
                    border: '1px solid rgba(212,175,55,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: fonts.display,
                    fontWeight: 900,
                    fontSize: 15,
                    color: colors.ink[900],
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  {r}
                </div>
              ))}
              <div
                style={{
                  width: 36,
                  height: 50,
                  background: 'linear-gradient(135deg, #2a0a3a, #1a0a2a)',
                  borderRadius: 6,
                  border: '1px solid rgba(160,80,200,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                🃏
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: colors.ivory[300], opacity: 0.8 }}>
              {t('deck.jokerNote')}
            </p>
          </RuleCard>
        </div>
      ),
    },
    {
      id: 'trump',
      icon: '♠',
      title: t('sections.trump'),
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RuleCard>
            <p style={{ margin: 0 }}>{t('trump.p1')}</p>
          </RuleCard>
          <RuleCard>
            <SectionTitle label={t('trump.rules')} />
            <RuleList
              items={[t('trump.rule1'), t('trump.rule2'), t('trump.rule3'), t('trump.rule4')]}
            />
          </RuleCard>
        </div>
      ),
    },
    {
      id: 'turn',
      icon: '🔄',
      title: t('sections.turn'),
      content: (
        <RuleCard>
          <SectionTitle label={t('turn.title')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <Step n={1} text={<>{t('turn.step1')}</>} />
            <Step n={2} text={<>{t('turn.step2')}</>} />
            <Step n={3} text={<>{t('turn.step3')}</>} />
            <Step n={4} text={<>{t('turn.step4')}</>} />
            <Step n={5} text={<>{t('turn.step5')}</>} />
          </div>
        </RuleCard>
      ),
    },
    {
      id: 'stacking',
      icon: '📤',
      title: t('sections.stacking'),
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RuleCard>
            <p style={{ margin: 0 }}>{t('stacking.p1')}</p>
            <p style={{ margin: '10px 0 0' }}>{t('stacking.p2')}</p>
          </RuleCard>
          <RuleCard>
            <SectionTitle label={t('stacking.limit')} />
            <p style={{ margin: '8px 0 0' }}>{t('stacking.limitDesc')}</p>
          </RuleCard>
        </div>
      ),
    },
    {
      id: 'modes',
      icon: '🏆',
      title: t('sections.modes'),
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RuleCard>
            <SectionTitle label={t('modes.classicTitle')} />
            <p style={{ margin: '8px 0 0' }}>{t('modes.classicDesc')}</p>
            <RuleList items={[t('modes.classicRule1'), t('modes.classicRule2')]} />
          </RuleCard>
          <RuleCard>
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                color: '#a0d4a0',
                fontFamily: fonts.display,
                letterSpacing: 1,
              }}
            >
              {t('modes.teamsTitle')}
            </p>
            <p style={{ margin: '8px 0 0' }}>{t('modes.teamsDesc')}</p>
            <RuleList
              items={[t('modes.teamsRule1'), t('modes.teamsRule2'), t('modes.teamsRule3')]}
            />
          </RuleCard>
          <RuleCard>
            <SectionTitle label={t('modes.rankedTitle')} />
            <p style={{ margin: '8px 0 0' }}>{t('modes.rankedDesc')}</p>
          </RuleCard>
        </div>
      ),
    },
    {
      id: 'jokers',
      icon: '🃏',
      title: t('sections.jokers'),
      content: (
        <RuleCard>
          <p style={{ margin: 0 }}>{t('jokers.p1')}</p>
          <p style={{ margin: '10px 0 0' }}>{t('jokers.p2')}</p>
        </RuleCard>
      ),
    },
    {
      id: 'tips',
      icon: '💡',
      title: t('sections.tips'),
      content: (
        <RuleCard>
          <RuleList
            items={[
              t('tips.tip1'),
              t('tips.tip2'),
              t('tips.tip3'),
              t('tips.tip4'),
              t('tips.tip5'),
              t('tips.tip6'),
            ]}
          />
        </RuleCard>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 96, paddingTop: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 28, padding: '0 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 50,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.6))',
            }}
          />
          <span style={{ fontSize: 22 }}>📖</span>
          <div
            style={{
              width: 50,
              height: 1,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.6), transparent)',
            }}
          />
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 5,
            textTransform: 'uppercase',
            backgroundImage: 'linear-gradient(180deg, #fce28a 0%, #d4af37 45%, #8b6914 85%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {t('title')}
        </div>
        <div
          style={{
            fontSize: 11,
            color: colors.ivory[300],
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginTop: 4,
            opacity: 0.7,
            fontStyle: 'italic',
          }}
        >
          {t('subtitle')}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px' }}>
        {sections.map((s) => (
          <AccordionItem
            key={s.id}
            id={s.id}
            icon={s.icon}
            title={s.title}
            isOpen={openId === s.id}
            onToggle={() => toggle(s.id)}
          >
            {s.content}
          </AccordionItem>
        ))}
      </div>
    </div>
  );
};
