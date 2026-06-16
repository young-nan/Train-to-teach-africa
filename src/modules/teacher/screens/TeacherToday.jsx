/**
 * TeacherToday.jsx — Teacher's daily dashboard
 * Shows today's lesson schedule, class attendance summary, and students needing support.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  ListItem, LoadingScreen, Empty, Alert,
} from '@/components/ui';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function CalendarStrip() {
  const today = new Date();
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
      {days.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        return (
          <div
            key={i}
            className="shrink-0 w-12 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all"
            style={{
              background: isToday ? 'var(--product-accent)' : 'var(--c-surface-3)',
              border: `1px solid ${isToday ? 'transparent' : 'var(--c-line-1)'}`,
            }}
          >
            <div className="text-[10px]" style={{ color: isToday ? '#1a130580' : 'var(--c-ink-4)' }}>{DAYS[d.getDay()]}</div>
            <div className="text-[17px] font-bold" style={{ color: isToday ? '#1a1305' : 'var(--c-ink-0)' }}>{d.getDate()}</div>
            {isToday && <div className="w-1 h-1 rounded-full bg-[#1a1305] opacity-50" />}
          </div>
        );
      })}
    </div>
  );
}

function LessonRow({ time, subject, topic, done, current }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{
        background: current ? 'rgba(34,184,166,0.08)' : 'transparent',
        border:     `1px solid ${current ? 'rgba(34,184,166,0.2)' : 'transparent'}`,
      }}
    >
      <div className="font-mono text-[11px] text-[var(--c-ink-4)] w-12 shrink-0">{time}</div>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: done    ? 'rgba(63,185,80,0.15)'  :
                      current ? 'rgba(34,184,166,0.15)' : 'var(--c-surface-4)',
          color:      done    ? 'var(--c-green-400)'   :
                      current ? 'var(--c-teal-400)'    : 'var(--c-ink-4)',
        }}
      >
        <i className={`ti ti-${done ? 'check' : current ? 'player-play' : 'book'} text-[16px]`} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--c-ink-0)] truncate">{subject}</div>
        <div className="text-[11px] text-[var(--c-ink-3)] truncate">{topic}</div>
      </div>
      <div className="shrink-0">
        {done    && <Chip variant="green" size="sm">Done</Chip>}
        {current && <Chip variant="teal"  size="sm">Now</Chip>}
      </div>
    </div>
  );
}

export default function TeacherToday() {
  const { profile } = useAuth();

  return (
    <div>
      <PageHeader
        eyebrow={`Teacher · ${profile?.school_name ?? 'My School'}`}
        title={`Good morning, ${profile?.first_name ?? 'Teacher'}`}
        subtitle={new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
      >
        <Button variant="ghost" icon="printer">Print plan</Button>
      </PageHeader>

      <CalendarStrip />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <KpiCard label="Lessons today" value="5"  deltaDir="flat" icon="book-2"    />
        <KpiCard label="Present"        value="23" deltaDir="up"   delta="96%"      icon="user-check" />
        <KpiCard label="Scores pending" value="2"  deltaDir="down" delta="From yesterday" icon="clipboard" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Lesson plan */}
        <Card>
          <CardHeader title="Today's lesson plan" action="Print" />
          <div className="space-y-1">
            <LessonRow time="8:00"  subject="Mathematics"     topic="Multiplication of 2-digit numbers" done    />
            <LessonRow time="9:00"  subject="English Language" topic="Reading comprehension — My Family"  done    />
            <LessonRow time="10:30" subject="Basic Science"    topic="Plants and Their Parts"            current />
            <LessonRow time="11:30" subject="Social Studies"   topic="Our Community Helpers"                     />
            <LessonRow time="13:00" subject="CRS"              topic="The Good Samaritan"                        />
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Support alerts */}
          <Card>
            <CardHeader title="Students needing support" />
            <div className="space-y-2">
              <div className="flex gap-3 p-3 rounded-lg" style={{ background: 'rgba(239,83,80,0.07)', borderLeft: '3px solid var(--c-red-400)' }}>
                <i className="ti ti-user-x text-[17px] text-[var(--c-red-400)] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--c-ink-1)]">Amara Okafor — missed 4 lessons in Basic Science</div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">Contact parent · Flag for intervention</div>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-lg" style={{ background: 'rgba(245,165,36,0.07)', borderLeft: '3px solid var(--c-amber-400)' }}>
                <i className="ti ti-chart-line-down text-[17px] text-[var(--c-amber-400)] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-[13px] font-medium text-[var(--c-ink-1)]">Kemi Adeyemi — below 50% in last 3 Maths assessments</div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">Recommend revision materials</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: 'calendar-stats', label: 'Mark attendance' },
                { icon: 'clipboard-list', label: 'Enter grades'    },
                { icon: 'message-dots',   label: 'Message parent'  },
                { icon: 'alert-triangle', label: 'Log concern'     },
              ].map(a => (
                <button
                  key={a.label}
                  className="flex items-center gap-2 p-3 rounded-lg bg-[var(--c-surface-3)] hover:bg-[var(--c-surface-4)] transition-colors text-[12px] font-medium text-[var(--c-ink-1)]"
                >
                  <i className={`ti ti-${a.icon} text-[16px] accent-text`} aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
