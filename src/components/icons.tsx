import { forwardRef } from "react";
import { HugeiconsIcon, type HugeiconsProps, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  AlertCircleIcon,
  Archive01Icon,
  ArchiveArrowUpIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  Attachment01Icon,
  BookOpen01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  Cancel01Icon,
  ChartLineData01Icon,
  ChartScatterIcon,
  CheckmarkCircle01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CloudUploadIcon,
  CompassIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  Database01Icon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  FileDownloadIcon,
  FileValidationIcon,
  FireIcon,
  FolderAddIcon,
  GridViewIcon,
  HelpCircleIcon,
  InboxIcon,
  InformationCircleIcon,
  Key01Icon,
  Layers01Icon,
  LayoutTopIcon,
  LinkSquare02Icon,
  ListViewIcon,
  Loading03Icon,
  Logout01Icon,
  Message01Icon,
  MinusSignIcon,
  MoneyReceive01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  RefreshIcon,
  RotateLeft01Icon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SquareLock02Icon,
  StarIcon,
  Target02Icon,
  TaskDone01Icon,
  TestTube01Icon,
  Tick02Icon,
  UnfoldMoreIcon,
  Upload01Icon,
  UserAdd01Icon,
  UserCheck01Icon,
  UserGroupIcon,
  UserRemove01Icon,
  ViewIcon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  ChartColumnIcon,
  ChartIncreaseIcon,
  Flag02Icon,
  HandshakeIcon,
  Home04Icon,
  LeftToRightListBulletIcon,
  MessageQuestionIcon,
  Note01Icon,
  PercentCircleIcon,
  RealEstate01Icon,
  UserLove01Icon,
} from "@hugeicons/core-free-icons";

// The app's icon set: Hugeicons (shadcn iconLibrary "hugeicons"), exposed under
// stable, descriptive names so call sites read `<Search size={14} />` and the
// glyph behind a name can change in one place. Props follow HugeiconsIcon
// (size, strokeWidth, className, aria-*); stroke defaults to 1.75, a touch
// lighter than Hugeicons' 2-weight look at small sizes.

export type IconProps = Omit<HugeiconsProps, "icon" | "altIcon" | "ref">;
export type AppIcon = ReturnType<typeof make>;

function make(glyph: IconSvgElement, name: string) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ strokeWidth = 1.75, ...props }, ref) {
    return <HugeiconsIcon ref={ref} icon={glyph} strokeWidth={strokeWidth} {...props} />;
  });
  Icon.displayName = name;
  return Icon;
}

// Status & feedback
export const AlertTriangle = make(Alert02Icon, "AlertTriangle");
export const TriangleAlert = make(Alert02Icon, "TriangleAlert");
export const CircleAlert = make(AlertCircleIcon, "CircleAlert");
export const Info = make(InformationCircleIcon, "Info");
export const CircleHelp = make(HelpCircleIcon, "CircleHelp");
export const Check = make(Tick02Icon, "Check");
export const CircleCheck = make(CheckmarkCircle01Icon, "CircleCheck");
export const CheckCircle2 = make(CheckmarkCircle02Icon, "CheckCircle2");
export const Loader2 = make(Loading03Icon, "Loader2");
export const Flame = make(FireIcon, "Flame");
export const Star = make(StarIcon, "Star");
export const Sparkles = make(SparklesIcon, "Sparkles");

// Arrows & chevrons
export const ArrowLeft = make(ArrowLeft01Icon, "ArrowLeft");
export const ArrowRight = make(ArrowRight02Icon, "ArrowRight");
export const ArrowUpRight = make(ArrowUpRight01Icon, "ArrowUpRight");
export const ChevronDown = make(ArrowDown01Icon, "ChevronDown");
export const ChevronUp = make(ArrowUp01Icon, "ChevronUp");
export const ChevronLeft = make(ArrowLeft01Icon, "ChevronLeft");
export const ChevronRight = make(ArrowRight01Icon, "ChevronRight");
export const ChevronsUpDown = make(UnfoldMoreIcon, "ChevronsUpDown");
export const ExternalLink = make(LinkSquare02Icon, "ExternalLink");
export const RefreshCw = make(RefreshIcon, "RefreshCw");
export const RotateCcw = make(RotateLeft01Icon, "RotateCcw");

// Actions
export const Plus = make(PlusSignIcon, "Plus");
export const Minus = make(MinusSignIcon, "Minus");
export const X = make(Cancel01Icon, "X");
export const Pencil = make(PencilEdit02Icon, "Pencil");
export const Trash2 = make(Delete02Icon, "Trash2");
export const Copy = make(Copy01Icon, "Copy");
export const Search = make(Search01Icon, "Search");
export const Send = make(SentIcon, "Send");
export const Download = make(Download01Icon, "Download");
export const Upload = make(Upload01Icon, "Upload");
export const UploadCloud = make(CloudUploadIcon, "UploadCloud");
export const Paperclip = make(Attachment01Icon, "Paperclip");
export const Eye = make(ViewIcon, "Eye");
export const SlidersHorizontal = make(SlidersHorizontalIcon, "SlidersHorizontal");
export const Archive = make(Archive01Icon, "Archive");
export const ArchiveRestore = make(ArchiveArrowUpIcon, "ArchiveRestore");
export const LogOut = make(Logout01Icon, "LogOut");

// Objects & places
export const LayoutDashboard = make(DashboardSquare01Icon, "LayoutDashboard");
export const LayoutGrid = make(GridViewIcon, "LayoutGrid");
export const PanelsTopLeft = make(LayoutTopIcon, "PanelsTopLeft");
export const Layers = make(Layers01Icon, "Layers");
export const ListTree = make(ListViewIcon, "ListTree");
export const Target = make(Target02Icon, "Target");
export const Compass = make(CompassIcon, "Compass");
export const FileText = make(File01Icon, "FileText");
export const FileCheck2 = make(FileValidationIcon, "FileCheck2");
export const FileDown = make(FileDownloadIcon, "FileDown");
export const FolderPlus = make(FolderAddIcon, "FolderPlus");
export const BookOpen = make(BookOpen01Icon, "BookOpen");
export const ClipboardCheck = make(TaskDone01Icon, "ClipboardCheck");
export const CalendarDays = make(Calendar03Icon, "CalendarDays");
export const CalendarCheck = make(CalendarCheckIn01Icon, "CalendarCheck");
export const Clock = make(Clock01Icon, "Clock");
export const Inbox = make(InboxIcon, "Inbox");
export const MessageSquare = make(Message01Icon, "MessageSquare");
export const Database = make(Database01Icon, "Database");
export const LineChart = make(ChartLineData01Icon, "LineChart");
export const ScatterChart = make(ChartScatterIcon, "ScatterChart");
export const FlaskConical = make(TestTube01Icon, "FlaskConical");
export const HandCoins = make(MoneyReceive01Icon, "HandCoins");
export const Settings = make(Settings01Icon, "Settings");

// People & security
export const Users = make(UserGroupIcon, "Users");
export const UserPlus = make(UserAdd01Icon, "UserPlus");
export const UserMinus = make(UserRemove01Icon, "UserMinus");
export const UserCheck = make(UserCheck01Icon, "UserCheck");
export const KeyRound = make(Key01Icon, "KeyRound");
export const Lock = make(SquareLock02Icon, "Lock");
export const ShieldCheck = make(Shield01Icon, "ShieldCheck");

// Strategy Review sections
export const ArrowDown = make(ArrowDown02Icon, "ArrowDown");
export const ArrowUp = make(ArrowUp02Icon, "ArrowUp");
export const ListBullets = make(LeftToRightListBulletIcon, "ListBullets");
export const House = make(Home04Icon, "House");
export const Note = make(Note01Icon, "Note");
export const BarChart = make(ChartColumnIcon, "BarChart");
export const Handshake = make(HandshakeIcon, "Handshake");
export const Building = make(RealEstate01Icon, "Building");
export const UserHeart = make(UserLove01Icon, "UserHeart");
export const TrendingUp = make(ChartIncreaseIcon, "TrendingUp");
export const Percent = make(PercentCircleIcon, "Percent");
export const Flag = make(Flag02Icon, "Flag");
export const MessageQuestion = make(MessageQuestionIcon, "MessageQuestion");
