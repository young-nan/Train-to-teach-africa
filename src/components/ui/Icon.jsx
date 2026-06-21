/**
 * Icon.jsx — drop-in replacement for the tabler webfont CDN import.
 *
 * Why this exists: the original build loaded icon glyphs from a CDN
 * stylesheet (`@tabler/icons-webfont`). Production's Content-Security-Policy
 * only allows `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
 * so the CDN stylesheet was silently blocked and every icon in the app
 * failed to render — which is why buttons, nav items, and KPI cards looked
 * "dead" or non-interactive in production.
 *
 * Fix: use the npm-installed `@tabler/icons-react` package instead. These
 * are real React SVG components bundled into our own JS — no external
 * request, no CSP exception needed, and they render even if a stylesheet
 * fails to load.
 *
 * Performance note: we import only the ~107 specific icons this app
 * actually uses (named imports below), rather than `import * as Icons`.
 * The wildcard import pulls in all ~4,000+ icons in the package and
 * inflates the production bundle by several megabytes — named imports let
 * the bundler tree-shake everything else away.
 *
 * Usage: <Icon name="bell" className="text-[18px]" />
 * This mirrors the old `<i className="ti ti-bell" />` call sites so the
 * rest of the codebase didn't need to change shape — only the import.
 *
 * Adding a new icon: add the name to ICON_MAP below, importing the
 * matching Tabler component above it. Find icon names at
 * https://tabler.io/icons
 */

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconAward,
  IconBell,
  IconBellOff,
  IconBolt,
  IconBook2,
  IconBookOff,
  IconBooks,
  IconBrandWhatsapp,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarEvent,
  IconCalendarOff,
  IconCalendarPlus,
  IconCalendarStats,
  IconCalendarWeek,
  IconCalendarX,
  IconCertificate,
  IconChalkboard,
  IconChartArea,
  IconChartBar,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconClipboard,
  IconClipboardList,
  IconClipboardX,
  IconClock,
  IconCode,
  IconCreditCard,
  IconDatabase,
  IconDeviceFloppy,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconFileAnalytics,
  IconFileCertificate,
  IconFileCheck,
  IconFilePlus,
  IconFileText,
  IconFlame,
  IconGlobe,
  IconHeart,
  IconHelpCircle,
  IconHistory,
  IconHome,
  IconIdBadge2,
  IconInbox,
  IconInfoCircle,
  IconKey,
  IconLayersIntersect,
  IconLayoutDashboard,
  IconLock,
  IconLogout,
  IconMail,
  IconMap,
  IconMapPin,
  IconMenu2,
  IconMessageDots,
  IconMessages,
  IconNotes,
  IconPencil,
  IconPhone,
  IconPlayerPlay,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceipt2,
  IconSchool,
  IconSearch,
  IconSend,
  IconServer,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconShieldX,
  IconSpeakerphone,
  IconStar,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconTrophy,
  IconUpload,
  IconUser,
  IconUserCheck,
  IconUserCircle,
  IconUserPlus,
  IconUserQuestion,
  IconUserStar,
  IconUserX,
  IconUsers,
  IconVideo,
  IconWallet,
  IconX,
  IconPoint,
} from '@tabler/icons-react';

const ICON_MAP = {
  'alert': IconAlertTriangle,
  'alert-circle': IconAlertCircle,
  'alert-triangle': IconAlertTriangle,
  'arrow-left': IconArrowLeft,
  'arrow-right': IconArrowRight,
  'award': IconAward,
  'bell': IconBell,
  'bell-off': IconBellOff,
  'bolt': IconBolt,
  'book-2': IconBook2,
  'book-open': IconBook2,
  'book-x': IconBookOff,
  'books': IconBooks,
  'brand-whatsapp': IconBrandWhatsapp,
  'building-school': IconSchool,
  'calendar': IconCalendar,
  'calendar-check': IconCalendarCheck,
  'calendar-event': IconCalendarEvent,
  'calendar-off': IconCalendarOff,
  'calendar-plus': IconCalendarPlus,
  'calendar-stats': IconCalendarStats,
  'calendar-week': IconCalendarWeek,
  'calendar-x': IconCalendarX,
  'certificate': IconCertificate,
  'chalkboard': IconChalkboard,
  'chart-area': IconChartArea,
  'chart-bar': IconChartBar,
  'chart-line': IconChartLine,
  'chart-line-down': IconTrendingDown,
  'check': IconCheck,
  'chevron-down': IconChevronDown,
  'chevron-right': IconChevronRight,
  'chevron-up': IconChevronUp,
  'circle-check': IconCircleCheck,
  'clipboard': IconClipboard,
  'clipboard-list': IconClipboardList,
  'clipboard-x': IconClipboardX,
  'clock': IconClock,
  'code': IconCode,
  'credit-card': IconCreditCard,
  'database': IconDatabase,
  'device-floppy': IconDeviceFloppy,
  'dots-vertical': IconDotsVertical,
  'download': IconDownload,
  'edit': IconEdit,
  'external-link': IconExternalLink,
  'eye': IconEye,
  'file-analytics': IconFileAnalytics,
  'file-certificate': IconFileCertificate,
  'file-check': IconFileCheck,
  'file-plus': IconFilePlus,
  'file-text': IconFileText,
  'flame': IconFlame,
  'globe': IconGlobe,
  'heart': IconHeart,
  'help-circle': IconHelpCircle,
  'history': IconHistory,
  'home': IconHome,
  'id-badge-2': IconIdBadge2,
  'inbox': IconInbox,
  'info-circle': IconInfoCircle,
  'key': IconKey,
  'layers': IconLayersIntersect,
  'layout-dashboard': IconLayoutDashboard,
  'lock': IconLock,
  'logout': IconLogout,
  'mail': IconMail,
  'map': IconMap,
  'map-pin': IconMapPin,
  'menu-2': IconMenu2,
  'message-dots': IconMessageDots,
  'messages': IconMessages,
  'notes': IconNotes,
  'pencil': IconPencil,
  'phone': IconPhone,
  'player-play': IconPlayerPlay,
  'plus': IconPlus,
  'printer': IconPrinter,
  'receipt': IconReceipt,
  'receipt-2': IconReceipt2,
  'school': IconSchool,
  'search': IconSearch,
  'send': IconSend,
  'server': IconServer,
  'settings': IconSettings,
  'shield': IconShield,
  'shield-check': IconShieldCheck,
  'shield-x': IconShieldX,
  'speakerphone': IconSpeakerphone,
  'star': IconStar,
  'trash': IconTrash,
  'trending-down': IconTrendingDown,
  'trending-right': IconArrowRight,
  'trending-up': IconTrendingUp,
  'trophy': IconTrophy,
  'upload': IconUpload,
  'user': IconUser,
  'user-check': IconUserCheck,
  'user-circle': IconUserCircle,
  'user-plus': IconUserPlus,
  'user-question': IconUserQuestion,
  'user-star': IconUserStar,
  'user-x': IconUserX,
  'users': IconUsers,
  'video': IconVideo,
  'wallet': IconWallet,
  'x': IconX,
};

export function Icon({ name, className = '', size = 18, strokeWidth = 1.75, style, ...rest }) {
  const Component = ICON_MAP[name];
  if (!Component) {
    if (import.meta.env?.DEV) {
      console.warn(`[Icon] Unknown icon name: "${name}". Falling back to a neutral placeholder.`);
    }
    return <IconPoint className={className} size={size} strokeWidth={strokeWidth} style={style} aria-hidden="true" {...rest} />;
  }
  return (
    <Component
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}

export default Icon;
