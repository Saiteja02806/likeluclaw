import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePlan } from '@/lib/usePlan';
import { toast } from 'sonner';
import {
  Plug,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Unplug,
  RefreshCw,
  Zap,
  // Trash2,      // Disabled — MCP section removed
  // Globe,       // Disabled — MCP section removed
  AlertCircle,
  X,
  // BookOpen,    // Disabled — MCP section removed
  Flag,
  Send,
  Crown,
  // ChevronRight, // Disabled — MCP section removed
  // Server,      // Disabled — MCP section removed
  // Plus,        // Disabled — MCP section removed
} from 'lucide-react';

// ── Real SVG brand logos ────────────────────────────────────────
const GmailLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="20" height="16" rx="2.5" stroke="#A78BFA" strokeWidth="1.8"/>
    <path d="M2 7l10 6.5L22 7" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SheetsLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="#A78BFA" strokeWidth="1.8"/>
    <line x1="3" y1="8" x2="21" y2="8" stroke="#A78BFA" strokeWidth="1.2"/>
    <line x1="3" y1="13" x2="21" y2="13" stroke="#A78BFA" strokeWidth="1.2"/>
    <line x1="3" y1="18" x2="21" y2="18" stroke="#A78BFA" strokeWidth="1.2"/>
    <line x1="10" y1="8" x2="10" y2="22" stroke="#A78BFA" strokeWidth="1.2"/>
  </svg>
);
const CalendarLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2.5" stroke="#A78BFA" strokeWidth="1.8"/>
    <path d="M3 9h18" stroke="#A78BFA" strokeWidth="1.8"/>
    <path d="M8 2v4M16 2v4" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="7" y="12" width="3" height="2.5" rx="0.5" fill="#8B5CF6"/>
    <rect x="14" y="12" width="3" height="2.5" rx="0.5" fill="#A78BFA" opacity="0.5"/>
    <rect x="7" y="16.5" width="3" height="2.5" rx="0.5" fill="#A78BFA" opacity="0.5"/>
  </svg>
);
const DriveLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L4 15h7l1-2h8L12 2z" stroke="#A78BFA" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M4 15l3 5h10l3-5H4z" stroke="#8B5CF6" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
);
const SlackLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
  </svg>
);
const NotionLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="white">
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.56 2.09c-.42-.326-.98-.7-2.055-.606L3.667 2.61c-.466.046-.56.28-.373.466l1.165 1.132zm.793 3.172v13.867c0 .746.373 1.026 1.213.98l14.523-.84c.84-.046.933-.56.933-1.166V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.046-.746.326-.746.886v.14zm14.337.42c.093.42 0 .84-.42.886l-.7.14v10.264c-.606.326-1.166.513-1.633.513-.746 0-.933-.233-1.493-.933l-4.573-7.178v6.95l1.446.327s0 .84-1.166.84l-3.218.186c-.093-.186 0-.653.326-.746l.84-.233V9.854L7.822 9.76c-.093-.42.14-1.026.793-1.073l3.452-.233 4.76 7.271v-6.44l-1.213-.14c-.093-.513.28-.886.746-.933l3.219-.186h.001z" fillRule="evenodd"/>
  </svg>
);
const GitHubLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="white">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);
const HubSpotLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#FF7A59">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.198 2.198 0 0 0 17.23.836h-.066a2.198 2.198 0 0 0-2.198 2.198v.066c0 .868.51 1.62 1.245 1.975v2.865a5.934 5.934 0 0 0-3.238 1.632L6.18 4.574a2.543 2.543 0 0 0 .072-.576 2.554 2.554 0 1 0-2.554 2.554c.56 0 1.074-.184 1.494-.494l6.728 4.882A5.901 5.901 0 0 0 11.198 14c0 1.2.358 2.316.97 3.252L9.93 19.49a2.005 2.005 0 0 0-1.29-.468 2.024 2.024 0 1 0 2.024 2.024c0-.477-.168-.914-.446-1.26l2.19-2.192a5.937 5.937 0 1 0 5.756-9.663z"/>
  </svg>
);
const TrelloLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0079BF">
    <rect x="1" y="1" width="22" height="22" rx="3.5" fill="#0079BF"/>
    <rect x="4" y="4" width="6.5" height="14" rx="1.3" fill="white"/>
    <rect x="13.5" y="4" width="6.5" height="9" rx="1.3" fill="white"/>
  </svg>
);
const DiscordLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#5865F2">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);
const LinearLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#5E6AD2">
    <path d="M2.513 16.907a11.907 11.907 0 0 1-.493-1.396l6.376-6.376a1.5 1.5 0 0 1 2.121 0l1.348 1.348a1.5 1.5 0 0 1 0 2.122l-6.376 6.376a11.907 11.907 0 0 1-2.976-2.074zm-1.103-3.14A12.03 12.03 0 0 1 1.2 12c0-5.946 4.854-10.8 10.8-10.8 5.946 0 10.8 4.854 10.8 10.8S17.946 22.8 12 22.8a12.03 12.03 0 0 1-1.767-.13l9.157-9.157a1.5 1.5 0 0 0 0-2.122l-4.781-4.781a1.5 1.5 0 0 0-2.122 0L1.41 13.767z"/>
  </svg>
);
const AsanaLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#F06A6A">
    <circle cx="12" cy="6" r="4.5"/>
    <circle cx="5" cy="16.5" r="4.5"/>
    <circle cx="19" cy="16.5" r="4.5"/>
  </svg>
);

// ── New app logos ────────────────────────────────────────────
const GoogleDocsLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#A78BFA" strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M14 2v6h6" stroke="#A78BFA" strokeWidth="1.8" strokeLinejoin="round"/>
    <line x1="8" y1="13" x2="16" y2="13" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="16" x2="16" y2="16" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="8" y1="19" x2="13" y2="19" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ZoomLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#2D8CFF">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.243 16.5H6.5a1.5 1.5 0 0 1-1.5-1.5V9a1.5 1.5 0 0 1 1.5-1.5h4.257a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5zm7.743-1.5l-3-2.25v-1.5l3-2.25a.75.75 0 0 1 1.2.6v5.25a.75.75 0 0 1-1.2.6z"/>
  </svg>
);
const AirtableLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M11.52 1.305L2.34 4.77a.9.9 0 0 0 0 1.68l9.18 3.465a2.4 2.4 0 0 0 1.68 0l9.18-3.465a.9.9 0 0 0 0-1.68L13.2 1.305a2.4 2.4 0 0 0-1.68 0z" fill="#FCB400"/>
    <path d="M12.84 12.48V22.2a.6.6 0 0 0 .84.54l9.48-3.78a.6.6 0 0 0 .36-.54V8.7a.6.6 0 0 0-.84-.54l-9.48 3.78a.6.6 0 0 0-.36.54z" fill="#18BFFF"/>
    <path d="M10.68 12.84L1.8 9.18a.6.6 0 0 0-.84.54v9.84a.6.6 0 0 0 .36.54l8.88 3.54a.6.6 0 0 0 .84-.54v-9.72a.6.6 0 0 0-.36-.54z" fill="#F82B60"/>
  </svg>
);
const DropboxLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0061FF">
    <path d="M6 2l6 3.75L6 9.5 0 5.75zm12 0l6 3.75-6 3.75-6-3.75zM0 13.25L6 9.5l6 3.75L6 17zm18-3.75l6 3.75-6 3.75-6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75z"/>
  </svg>
);
const JiraLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#2684FF">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005z"/>
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005z" opacity="0.4"/>
    <path d="M17.36 5.754H5.789a5.218 5.218 0 0 0 5.232 5.216h2.13v2.056a5.215 5.215 0 0 0 5.213 5.215V6.759a1.005 1.005 0 0 0-1.005-1.005z"/>
    <path d="M23.152 0H11.58a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 24.155 12.487V1.005A1.005 1.005 0 0 0 23.152 0z"/>
  </svg>
);
const ClickUpLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path d="M3.6 16.8l3-2.4c2.1 2.7 3.3 3.6 5.4 3.6s3.3-.9 5.4-3.6l3 2.4C17.4 20.4 15 22.2 12 22.2s-5.4-1.8-8.4-5.4z" fill="#8930FD"/>
    <path d="M12 6l-7.2 6 2.4 2.1L12 10.2l4.8 3.9 2.4-2.1L12 6z" fill="#49CCF9"/>
  </svg>
);
const SalesforceLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#00A1E0">
    <path d="M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306c1.56 0 2.954.862 3.684 2.145a4.627 4.627 0 0 1 1.98-.447c2.567 0 4.647 2.088 4.647 4.665s-2.08 4.665-4.647 4.665a4.61 4.61 0 0 1-1.16-.148 3.86 3.86 0 0 1-3.456 2.14 3.834 3.834 0 0 1-1.773-.43 4.37 4.37 0 0 1-3.893 2.388c-2.07 0-3.82-1.44-4.278-3.373a3.872 3.872 0 0 1-.517.035C1.734 15.749 0 14.008 0 11.868c0-1.474.826-2.756 2.04-3.405a3.93 3.93 0 0 1-.162-1.12c0-2.18 1.762-3.946 3.934-3.946a3.917 3.917 0 0 1 4.194 2.018z"/>
  </svg>
);
const PipedriveLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill="#25292C"/>
    <path d="M12 5c-2.2 0-4 1.8-4 4 0 1.5.8 2.8 2 3.5V19h4v-6.5c1.2-.7 2-2 2-3.5 0-2.2-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="#17D083"/>
  </svg>
);
const ZendeskLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#03363D">
    <path d="M11.1 8.4V22H1L11.1 8.4zm0-6.4c0 2.8-2.3 5.1-5.1 5.1S1 4.8 1 2h10.1zM12.9 15.6V2H23L12.9 15.6zm0 6.4c0-2.8 2.3-5.1 5.1-5.1s5.1 2.3 5.1 5.1H12.9z"/>
  </svg>
);
const FreshdeskLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="4" fill="#25C16F"/>
    <path d="M12 6c-3.3 0-6 2.7-6 6v3c0 .6.4 1 1 1h1v-4c0-2.2 1.8-4 4-4s4 1.8 4 4v4h1c.6 0 1-.4 1-1v-3c0-3.3-2.7-6-6-6z" fill="white"/>
    <circle cx="9.5" cy="15" r="1.5" fill="white"/>
    <circle cx="14.5" cy="15" r="1.5" fill="white"/>
  </svg>
);
const IntercomLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#6AFDEF">
    <rect width="24" height="24" rx="5" fill="#1F1F1F"/>
    <path d="M19 11.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V7c0-.3.2-.5.5-.5s.5.2.5.5v4.5zm-2.5 2c0 .3-.2.5-.5.5s-.5-.2-.5-.5V5.5c0-.3.2-.5.5-.5s.5.2.5.5V13.5zm-2.5.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V5c0-.3.2-.5.5-.5s.5.2.5.5v9zm-2.5 0c0 .3-.2.5-.5.5s-.5-.2-.5-.5V5c0-.3.2-.5.5-.5s.5.2.5.5v9zM9 13.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V5.5c0-.3.2-.5.5-.5s.5.2.5.5V13.5zM6.5 12c0 .3-.2.5-.5.5s-.5-.2-.5-.5V7c0-.3.2-.5.5-.5s.5.2.5.5v5zm12 5.5c-.1 0-4.2 2-6.5 2s-6.4-2-6.5-2a.5.5 0 0 1 .4-.9c.1 0 4.1 1.9 6.1 1.9s6-1.9 6.1-1.9a.5.5 0 0 1 .4.9z" fill="#6AFDEF"/>
  </svg>
);
const ShopifyLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#96BF48">
    <path d="M15.337 3.415c-.024-.153-.174-.228-.29-.24-.117-.012-2.478-.048-2.478-.048s-1.644-1.596-1.824-1.776c-.18-.18-.528-.126-.666-.084L9.15 1.56C8.982 1.02 8.7.528 8.292.312 7.812.048 7.2 0 6.744 0c-.036 0-.072 0-.108.012-.036-.036-.072-.072-.108-.096C6.12-.372 5.544.12 5.1.768c-.66.948-.936 2.148-1.044 2.724l-1.8.552c-.552.168-.57.186-.642.708-.054.39-1.512 11.628-1.512 11.628L13.2 18.6l6.6-1.428S15.36 3.567 15.337 3.415z"/>
  </svg>
);
const StripeLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#635BFF">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.849-6.591-7.305z"/>
  </svg>
);

const appLogoMap: Record<string, React.ReactNode> = {
  gmail: <GmailLogo />,
  googlesheets: <SheetsLogo />,
  googlecalendar: <CalendarLogo />,
  googledrive: <DriveLogo />,
  googledocs: <GoogleDocsLogo />,
  slack: <SlackLogo />,
  discord: <DiscordLogo />,
  zoom: <ZoomLogo />,
  notion: <NotionLogo />,
  airtable: <AirtableLogo />,
  dropbox: <DropboxLogo />,
  github: <GitHubLogo />,
  jira: <JiraLogo />,
  trello: <TrelloLogo />,
  linear: <LinearLogo />,
  asana: <AsanaLogo />,
  clickup: <ClickUpLogo />,
  hubspot: <HubSpotLogo />,
  salesforce: <SalesforceLogo />,
  pipedrive: <PipedriveLogo />,
  zendesk: <ZendeskLogo />,
  freshdesk: <FreshdeskLogo />,
  intercom: <IntercomLogo />,
  shopify: <ShopifyLogo />,
  stripe: <StripeLogo />,
};

// ── Interfaces ──────────────────────────────────────────────────
interface AppItem {
  slug: string;
  name: string;
  category: string;
  icon: string;
  connected: boolean;
  connectionId: string | null;
}

interface Employee {
  id: string;
  name: string;
}

// ── Component ───────────────────────────────────────────────────
export default function Integrations() {
  const { isPremium } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [totalConnected, setTotalConnected] = useState(0);

  // MCP Bridge state — Disabled, focusing on Telegram bot
  // const [mcpServers, setMcpServers] = useState<Record<string, { url: string; auth?: { type: string } }>>({});
  // const [mcpLoading, setMcpLoading] = useState(false);
  // const [mcpServerName, setMcpServerName] = useState('');
  // const [mcpServerUrl, setMcpServerUrl] = useState('');
  // const [mcpAuthToken, setMcpAuthToken] = useState('');
  // const [mcpSubmitting, setMcpSubmitting] = useState(false);
  // const [mcpRemoving, setMcpRemoving] = useState<string | null>(null);
  // const [hasMcpBridge, setHasMcpBridge] = useState(false);

  // Modal state — MCP modals disabled
  // const [mcpModalOpen, setMcpModalOpen] = useState(false);
  // const [guideOpen, setGuideOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportCategory, setReportCategory] = useState('integration');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees().catch(() => ({ employees: [] })),
  });
  const employees: Employee[] = empData?.employees || [];

  // Auto-select first employee
  useEffect(() => {
    if (employees.length > 0 && !employeeId) {
      setEmployeeId(employees[0].id);
    }
  }, [employees, employeeId]);

  // Check if MCP Bridge is installed — Disabled, focusing on Telegram bot
  // useEffect(() => {
  //   if (!employeeId) return;
  //   async function checkMcpBridge() {
  //     try {
  //       const data = await api.getInstalledSkills(employeeId!);
  //       const installed = data?.installed_skills || [];
  //       const has = installed.some((s: { skills?: { slug?: string } }) => s.skills?.slug === 'mcp-bridge');
  //       setHasMcpBridge(has);
  //     } catch {}
  //   }
  //   checkMcpBridge();
  // }, [employeeId]);

  const loadApps = useCallback(async () => {
    try {
      const data = await api.getIntegrationApps();
      setApps(data.apps || []);
      setTotalConnected(data.totalConnected || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load integrations';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // const loadMcpServers = useCallback(async () => { // Disabled — focusing on Telegram bot
  //   if (!employeeId) return;
  //   setMcpLoading(true);
  //   try {
  //     const data = await api.getMcpServers(employeeId);
  //     setMcpServers(data.servers || {});
  //   } catch {
  //     setMcpServers({});
  //   } finally {
  //     setMcpLoading(false);
  //   }
  // }, [employeeId]);

  useEffect(() => { loadApps(); }, [loadApps]);

  // useEffect(() => { // Disabled — focusing on Telegram bot
  //   if (employeeId && hasMcpBridge) loadMcpServers();
  // }, [employeeId, hasMcpBridge, loadMcpServers]);

  // Handle OAuth callback (runs in popup window that got redirected back)
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected) {
      setSearchParams({}, { replace: true });
      // Confirm the connection: queries Composio, saves to our DB, syncs container
      api.confirmConnection(connected).then(async () => {
        // Double-check: reload apps and verify it's actually connected
        const fresh = await api.getIntegrationApps();
        const app = (fresh.apps || []).find((a: AppItem) => a.slug === connected);
        if (app?.connected) {
          toast.success(`${connected} connected successfully!`);
        } else {
          toast.error(`${connected} connection could not be verified. Please try again.`);
        }
        setApps(fresh.apps || []);
        setTotalConnected(fresh.totalConnected || 0);
      }).catch(() => {
        toast.error(`${connected} connection failed or was not completed. Please try again.`);
        loadApps();
      });
    }
  }, [searchParams, setSearchParams, loadApps]);

  const handleConnect = async (slug: string) => {
    if (!employeeId) {
      toast.error('No employee found. Create an AI employee first.');
      return;
    }
    setConnecting(slug);
    try {
      const data = await api.connectIntegration(slug, employeeId);
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'width=600,height=700,scrollbars=yes');
        toast.info('Complete the authorization in the new window, then come back here.');
        let attempts = 0;
        let consecutiveErrors = 0;
        const poll = setInterval(async () => {
          attempts++;
          if (attempts > 30) {
            clearInterval(poll);
            setConnecting(null);
            toast.error(`${slug} connection timed out. Please try again.`);
            return;
          }
          try {
            // Try to confirm the connection (queries Composio → saves to DB → syncs container)
            await api.confirmConnection(slug);
            // If confirm succeeds, refresh the app list from our DB
            const fresh = await api.getIntegrationApps();
            const app = (fresh.apps || []).find((a: AppItem) => a.slug === slug);
            if (app?.connected) {
              clearInterval(poll);
              setApps(fresh.apps);
              setTotalConnected(fresh.totalConnected || 0);
              setConnecting(null);
              toast.success(`${slug} connected!`);
            }
            consecutiveErrors = 0;
          } catch {
            consecutiveErrors++;
            // If we get many consecutive errors after some attempts, the user likely didn't complete OAuth
            if (consecutiveErrors >= 5 && attempts >= 10) {
              clearInterval(poll);
              setConnecting(null);
              toast.error(`${slug} connection was not completed. Please try again.`);
            }
          }
        }, 4000);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
      setConnecting(null);
    }
  };

  const handleDisconnect = async (slug: string, connectionId: string) => {
    setDisconnecting(slug);
    try {
      await api.disconnectIntegration(connectionId);
      toast.success(`${slug} disconnected`);
      await loadApps();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setDisconnecting(null);
    }
  };

  // const handleMcpAdd = async () => { // Disabled — focusing on Telegram bot
  //   if (!mcpServerName.trim() || !mcpServerUrl.trim() || !employeeId) return;
  //   setMcpSubmitting(true);
  //   try {
  //     await api.configureMcp(employeeId, mcpServerName.trim(), mcpServerUrl.trim(), mcpAuthToken.trim() || undefined);
  //     toast.success(`MCP server "${mcpServerName}" added!`);
  //     setMcpServerName('');
  //     setMcpServerUrl('');
  //     setMcpAuthToken('');
  //     await loadMcpServers();
  //   } catch (err: unknown) {
  //     toast.error(err instanceof Error ? err.message : 'Failed to add server');
  //   } finally {
  //     setMcpSubmitting(false);
  //   }
  // };

  // const handleMcpRemove = async (name: string) => { // Disabled — focusing on Telegram bot
  //   if (!employeeId) return;
  //   setMcpRemoving(name);
  //   try {
  //     await api.removeMcpServer(employeeId, name);
  //     toast.success(`"${name}" removed`);
  //     await loadMcpServers();
  //   } catch (err: unknown) {
  //     toast.error(err instanceof Error ? err.message : 'Failed to remove server');
  //   } finally {
  //     setMcpRemoving(null);
  //   }
  // };

  const handleReportSubmit = async () => {
    if (!reportSubject.trim() || !reportDescription.trim()) return;
    setReportSubmitting(true);
    try {
      await api.submitReport({
        category: reportCategory,
        subject: reportSubject.trim(),
        description: reportDescription.trim(),
        page: 'integrations',
      });
      toast.success('Report submitted! We will review it shortly.');
      setReportSubject('');
      setReportDescription('');
      setReportCategory('integration');
      setReportOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  // const mcpServerCount = Object.keys(mcpServers).length; // Disabled — focusing on Telegram bot

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Plug className="h-7 w-7 text-amber-400" />
            Integrations
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Connect apps and services so your AI employee can use them.
            {totalConnected > 0 && (
              <span className="ml-2 text-emerald-400 font-medium">{totalConnected} app{totalConnected !== 1 ? 's' : ''} connected</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all cursor-pointer">
            <Flag className="h-3.5 w-3.5" />
            Report Issue
          </button>
          <button onClick={() => { setLoading(true); loadApps(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* No employees */}
      {employees.length === 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Create an employee first</p>
            <p className="text-xs text-zinc-400 mt-0.5">You need an AI employee before connecting integrations.</p>
          </div>
          <Link to="/employees/new" className="px-4 py-2 bg-white hover:bg-zinc-200 text-black text-sm font-semibold rounded-xl transition-all shrink-0 shadow-md shadow-white/10">
            Create Employee
          </Link>
        </div>
      )}

      {/* ────── SECTION 1: Custom MCP Servers — Disabled, focusing on Telegram bot ────── */}
      {/* <div className="rounded-2xl border border-zinc-700/50 bg-gradient-to-r from-zinc-900 to-zinc-900/80 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Server className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Custom MCP Servers
                {mcpServerCount > 0 && (
                  <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                    {mcpServerCount} connected
                  </span>
                )}
              </h2>
              <p className="text-[12px] text-zinc-500 mt-0.5">Connect Make.com, VAPI, or any MCP-compatible automation server</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 border border-zinc-700/50 transition-all cursor-pointer">
              <BookOpen className="h-3.5 w-3.5" />
              Setup Guide
            </button>
            <button onClick={() => { setMcpModalOpen(true); if (hasMcpBridge) loadMcpServers(); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md shadow-white/10">
              {hasMcpBridge ? (
                <><ChevronRight className="h-3.5 w-3.5" /> Manage MCPs</>
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Setup MCPs</>
              )}
            </button>
          </div>
        </div>
        {mcpServerCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(mcpServers).map(([name, srv]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span className="text-xs font-medium text-white">{name}</span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{srv.url.replace('https://', '').split('/')[0]}</span>
              </div>
            ))}
          </div>
        )}
      </div> */}

      {/* ────── SECTION 2: App Integrations (Composio) ────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">App Integrations</h2>
            <p className="text-[11px] text-zinc-500">One-click OAuth — your AI employee reads & writes data from these apps</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {apps.map((app) => (
              <div key={app.slug}
                className={`group relative rounded-2xl border p-5 transition-all duration-200 ${
                  app.connected ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}>
                {app.connected && (
                  <div className="absolute top-3 right-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-11 w-11 rounded-xl ${app.connected ? 'bg-emerald-500/10' : 'bg-zinc-800'} flex items-center justify-center`}>
                    {appLogoMap[app.slug] || <Plug className="h-6 w-6 text-zinc-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{app.name}</h3>
                    <p className="text-[11px] text-zinc-500">{app.category}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className={`text-[11px] font-medium ${app.connected ? 'text-emerald-400' : 'text-zinc-600'}`}>
                    {app.connected ? 'Connected' : 'Not connected'}
                  </span>
                  {!isPremium ? (
                    <Link to="/billing"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black transition-all cursor-pointer shadow-sm shadow-amber-500/20">
                      <Crown className="h-3 w-3" />
                      Upgrade to Connect
                    </Link>
                  ) : app.connected ? (
                    <button onClick={() => app.connectionId && handleDisconnect(app.slug, app.connectionId)}
                      disabled={disconnecting === app.slug}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                      {disconnecting === app.slug ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                      Disconnect
                    </button>
                  ) : (
                    <button onClick={() => handleConnect(app.slug)}
                      disabled={connecting === app.slug || !employeeId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white text-black hover:bg-zinc-200 transition-all cursor-pointer disabled:opacity-40 shadow-sm">
                      {connecting === app.slug ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════ MCP MODAL — Disabled, focusing on Telegram bot ════════════ */}
      {/* {mcpModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          ...MCP Modal content preserved locally...
        </div>
      , document.body)} */}

      {/* ════════════ GUIDE MODAL — Disabled, focusing on Telegram bot ════════════ */}
      {/* {guideOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          ...Guide Modal content preserved locally...
        </div>
      , document.body)} */}

      {/* ════════════ REPORT MODAL ════════════ */}
      {reportOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReportOpen(false)} />
          <div className="relative bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Report an Issue</h3>
              </div>
              <button onClick={() => setReportOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Category</label>
                <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-zinc-700/80 rounded-xl text-sm bg-zinc-800/80 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 transition-all cursor-pointer">
                  <option value="integration">App Integration Issue</option>
                  <option value="mcp">Custom MCP Issue</option>
                  <option value="connection">Connection Problem</option>
                  <option value="ui">UI/UX Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Subject</label>
                <input type="text" value={reportSubject} onChange={(e) => setReportSubject(e.target.value)} placeholder="Brief description of the issue"
                  className="w-full px-3 py-2.5 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Description</label>
                <textarea value={reportDescription} onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe what happened, what you expected, and any error messages you saw..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-zinc-700/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 bg-zinc-800/80 text-white placeholder-zinc-600 transition-all resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setReportOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleReportSubmit} disabled={!reportSubject.trim() || !reportDescription.trim() || reportSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer">
                  {reportSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
