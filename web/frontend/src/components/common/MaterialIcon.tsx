import type { CSSProperties, ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import AddOutlined from '@mui/icons-material/AddOutlined';
import AltRouteOutlined from '@mui/icons-material/AltRouteOutlined';
import ApiOutlined from '@mui/icons-material/ApiOutlined';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ArticleOutlined from '@mui/icons-material/ArticleOutlined';
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import CoffeeOutlined from '@mui/icons-material/CoffeeOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CrisisAlertOutlined from '@mui/icons-material/CrisisAlertOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined';
import FolderCopyOutlined from '@mui/icons-material/FolderCopyOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import HttpOutlined from '@mui/icons-material/HttpOutlined';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowDownOutlined from '@mui/icons-material/KeyboardArrowDownOutlined';
import KeyboardArrowUpOutlined from '@mui/icons-material/KeyboardArrowUpOutlined';
import KeyOutlined from '@mui/icons-material/KeyOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import MemoryOutlined from '@mui/icons-material/MemoryOutlined';
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffOutlined from '@mui/icons-material/NotificationsOffOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PowerSettingsNewOutlined from '@mui/icons-material/PowerSettingsNewOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import RemoveOutlined from '@mui/icons-material/RemoveOutlined';
import ReportOutlined from '@mui/icons-material/ReportOutlined';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import RouterOutlined from '@mui/icons-material/RouterOutlined';
import RuleOutlined from '@mui/icons-material/RuleOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import SensorsOutlined from '@mui/icons-material/SensorsOutlined';
import SentimentDissatisfiedOutlined from '@mui/icons-material/SentimentDissatisfiedOutlined';
import SettingsEthernetOutlined from '@mui/icons-material/SettingsEthernetOutlined';
import ShowChartOutlined from '@mui/icons-material/ShowChartOutlined';
import SpeedOutlined from '@mui/icons-material/SpeedOutlined';
import SportsEsportsOutlined from '@mui/icons-material/SportsEsportsOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import TerminalOutlined from '@mui/icons-material/TerminalOutlined';
import TimelineOutlined from '@mui/icons-material/TimelineOutlined';
import TimerOutlined from '@mui/icons-material/TimerOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import WifiOffOutlined from '@mui/icons-material/WifiOffOutlined';

interface MaterialIconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
}

type MaterialSvgIcon = ComponentType<SvgIconProps>;

const iconMap: Record<string, MaterialSvgIcon> = {
  add: AddOutlined,
  alt_route: AltRouteOutlined,
  api: ApiOutlined,
  apps: AppsOutlined,
  arrow_back: ArrowBackOutlined,
  arrow_downward: ArrowDownwardOutlined,
  arrow_upward: ArrowUpwardOutlined,
  article: ArticleOutlined,
  autorenew: AutorenewOutlined,
  bar_chart: BarChartOutlined,
  cancel: CancelOutlined,
  check: CheckOutlined,
  check_circle: CheckCircleOutlined,
  chevron_right: ChevronRightOutlined,
  close: CloseOutlined,
  cloud_off: CloudOffOutlined,
  code: CodeOutlined,
  coffee: CoffeeOutlined,
  content_copy: ContentCopyOutlined,
  crisis_alert: CrisisAlertOutlined,
  database: StorageOutlined,
  delete: DeleteOutlined,
  delete_outline: DeleteOutlineOutlined,
  deployed_code: CodeOutlined,
  description: DescriptionOutlined,
  dark_mode: DarkModeOutlined,
  edit: EditOutlined,
  error: ErrorOutlined,
  error_outline: ErrorOutlineOutlined,
  event: EventOutlined,
  expand_less: ExpandLessOutlined,
  expand_more: ExpandMoreOutlined,
  favorite: FavoriteOutlined,
  filter_alt: FilterAltOutlined,
  folder_copy: FolderCopyOutlined,
  help: HelpOutlined,
  help_outline: HelpOutlineOutlined,
  history: HistoryOutlined,
  home: HomeOutlined,
  hourglass_empty: HourglassEmptyOutlined,
  http: HttpOutlined,
  inbox: InboxOutlined,
  info: InfoOutlined,
  inventory_2: Inventory2Outlined,
  keyboard_arrow_down: KeyboardArrowDownOutlined,
  keyboard_arrow_up: KeyboardArrowUpOutlined,
  key: KeyOutlined,
  language: LanguageOutlined,
  light_mode: LightModeOutlined,
  lightbulb: LightbulbOutlined,
  lock: LockOutlined,
  memory: MemoryOutlined,
  monitor_heart: MonitorHeartOutlined,
  more_vert: MoreVertOutlined,
  notifications: NotificationsOutlined,
  notifications_active: NotificationsActiveOutlined,
  notifications_off: NotificationsOffOutlined,
  open_in_new: OpenInNewOutlined,
  payments: PaymentsOutlined,
  power_settings_new: PowerSettingsNewOutlined,
  progress_activity: SyncOutlined,
  refresh: RefreshOutlined,
  remove: RemoveOutlined,
  report: ReportOutlined,
  restart_alt: RestartAltOutlined,
  router: RouterOutlined,
  rule: RuleOutlined,
  save: SaveOutlined,
  schedule: ScheduleOutlined,
  search: SearchOutlined,
  search_off: SearchOffOutlined,
  security: SecurityOutlined,
  send: SendOutlined,
  sensors: SensorsOutlined,
  sentiment_dissatisfied: SentimentDissatisfiedOutlined,
  settings_ethernet: SettingsEthernetOutlined,
  show_chart: ShowChartOutlined,
  speed: SpeedOutlined,
  sports_esports: SportsEsportsOutlined,
  sync: SyncOutlined,
  terminal: TerminalOutlined,
  timeline: TimelineOutlined,
  timer: TimerOutlined,
  tune: TuneOutlined,
  unfold_more: UnfoldMoreOutlined,
  warning: WarningAmberOutlined,
  wifi_off: WifiOffOutlined,
};

export function MaterialIcon({ name, className = '', style }: MaterialIconProps) {
  const Icon = iconMap[name] ?? HelpOutlineOutlined;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center align-middle leading-none ${className}`.trim()}
      style={style}
    >
      <Icon fontSize="inherit" className="h-[1em] w-[1em] shrink-0" />
    </span>
  );
}