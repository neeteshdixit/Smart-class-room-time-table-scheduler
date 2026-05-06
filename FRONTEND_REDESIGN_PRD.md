# 🎓 SMART CLASSROOM TIMETABLE SCHEDULER
## Frontend Redesign - Product Requirements Document (PRD)

**Document Version:** 1.0  
**Last Updated:** 2025-05-04  
**Target Platform:** Web (React)  
**Team:** AI UI Generation + Frontend Development

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Objectives & Goals](#2-objectives--goals)
3. [Current Feature Inventory](#3-current-feature-inventory)
4. [User Roles & Personas](#4-user-roles--personas)
5. [UI/UX Design Requirements](#5-uiux-design-requirements)
6. [UI Components Library](#6-ui-components-library)
7. [Page-by-Page Design Specifications](#7-page-by-page-design-specifications)
8. [Timetable UI Design System](#8-timetable-ui-design-system)
9. [Design System & Brand Guidelines](#9-design-system--brand-guidelines)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Technology Stack & Libraries](#11-technology-stack--libraries)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Migration Strategy](#13-migration-strategy)
14. [Future Scope](#14-future-scope)

---

## 1. PROJECT OVERVIEW

### 1.1 What is the System?

**Smart Classroom Timetable Scheduler** is an academic resource planning platform for ITM University Gwalior that automates conflict-free timetable generation for faculty, students, and academic departments. The system supports:

- **Admin Portal**: Full control over academic configuration, timetable generation, and system analytics
- **Faculty Portal**: View assigned timetables, manage student sections, and access mentee responsibilities
- **Student Portal**: Daily timetable viewing with class schedules and course information
- **Email Notifications**: Real-time alerts for timetable updates and account events

### 1.2 Current Problem

The existing system uses:
- **Basic Bootstrap 5 UI** with minimal customization
- **Vanilla JavaScript** without modern framework architecture
- **Static dashboard layouts** with limited interactivity
- **No animations or visual feedback**
- **Poor mobile experience** on smaller screens
- **Not presentable** for hackathons or modern B2B platforms

### 1.3 Solution Vision

Rebuild the **entire frontend** using **React + Modern UI** while maintaining **100% backend compatibility**. Create a **hackathon-quality, enterprise-grade** interface that:

- Delivers **professional visual experience**
- Uses **3D elements and smooth animations**
- Provides **intuitive navigation and interactions**
- Supports **dark mode + light mode**
- Ensures **mobile-first responsive design**

---

## 2. OBJECTIVES & GOALS

### 2.1 Primary Objectives

1. **Build Modern React Frontend**
   - Migrate from vanilla JS to React component architecture
   - Implement modern state management (Context API / Redux)
   - Optimize performance and bundle size

2. **Advanced UI/UX Experience**
   - Implement glassmorphism and neumorphism design patterns
   - Add smooth page transitions and micro-interactions
   - Create premium animated components
   - Support light/dark theme switching

3. **3D Elements & Animations**
   - Integrate 3D visualizations for dashboard analytics
   - Add animated charts and data representations
   - Create interactive hover effects with depth perception
   - Implement animated loading states

4. **Enterprise Dashboard Experience**
   - Professional sidebar navigation
   - Advanced analytics dashboard
   - Real-time data updates (polling/WebSocket ready)
   - Notification system with animations

5. **Mobile-First Responsiveness**
   - Fully responsive on all devices (320px - 4K screens)
   - Touch-optimized interface
   - Adaptive layouts and components
   - Performance optimized for mobile networks

### 2.2 Success Metrics

- ✅ Page load time < 2 seconds
- ✅ Smooth 60fps animations throughout
- ✅ 100% API compatibility with existing backend
- ✅ Mobile lighthouse score > 90
- ✅ Zero breaking changes to backend logic

---

## 3. CURRENT FEATURE INVENTORY

### 3.1 Authentication & Access Control

**OTP-Based Login System**
- Email/ID based login
- 6-digit OTP verification
- Auto-resend OTP functionality
- OTP expiration (15 minutes default)
- Session-based authentication with JWT tokens

**User Signup (Role-Based)**
- Faculty signup with profile photo upload
- Admin signup (manual/system controlled)
- Role selection (Faculty / Mentor)
- Email verification
- Profile completeness validation

**Password Management**
- Forgot password with OTP verification
- Secure password reset flow
- Password strength validation
- Email confirmation

**Session Management**
- Auto-logout after inactivity
- Token refresh mechanism
- Multiple session handling
- Logout from all devices option

### 3.2 Admin Features

**Dashboard & Analytics**
- System health monitoring
- User statistics (admins, faculty, students, mentors)
- Total timetables generated
- System activity overview
- Department-wise breakdowns

**Master Data Management**

*Departments*
- Create, read, update, delete departments
- Department name and code management
- Department-specific configurations
- Department scheduling preferences

*Branches/Programs*
- Manage academic programs per department
- Program codes and names
- Program-to-department mapping
- Semester count per program

*Sections*
- Manage student sections/batches
- Section-to-program-semester mapping
- Section size configuration
- Lab section management

*Subjects*
- Subject creation with codes
- Subject-to-program-semester mapping
- Lecture vs Lab distinction
- Credit hour configuration
- Practical/Theory split management

*Faculty Management*
- Faculty profile management
- Subject expertise mapping
- Workload configuration
- Lab assignment capabilities
- Availability constraints

*Semesters*
- Define academic semesters
- Semester duration configuration
- Schedule configuration per semester
- Holiday management

*Department Schedule Configuration*
- Working days per week
- Time slots per day
- Break timings
- Special scheduling rules
- Lab time block configurations

**Timetable Generation & Management**
- Conflict-free timetable generation algorithm
- Generation with customizable constraints:
  - Faculty availability
  - Room capacity
  - Subject prerequisites
  - Lab-specific requirements (100+ minute continuous blocks)
- Timetable history tracking
- Timetable version management
- Timetable publishing to students/faculty

**Reports & Analytics**
- Faculty workload reports
- Room utilization reports
- Subject distribution analysis
- Conflict detection reports
- Export to CSV/PDF

**Activity Logging**
- System event tracking
- User action auditing
- Change logs for master data
- Login/logout tracking
- Timetable generation history

### 3.3 Faculty Features

**Personal Timetable View**
- Faculty teaching schedule
- Subject-wise class assignments
- Room/section details
- Time conflict detection
- Weekly/daily/semester view options

**Mentor Features (Faculty with Mentor Role)**
- Access to assigned section timetables
- Student batch management
- Section-specific scheduling
- Mentor-student relationship mapping

**Student Timetable Access (Faculty Role)**
- View all section timetables
- Student batch-wise filtering
- Student timetable download
- Student timetable sharing (via link/email)
- Class-wise student lists

### 3.4 Student Features

**Student Portal**
- Daily/weekly timetable view
- Today's classes highlight
- Subject/instructor information
- Room location details
- Class timing display

**Student Access Control**
- Token-based read-only access
- Time-based timetable visibility
- Semester-based filtering

### 3.5 Notification System

**Email Notifications**
- New timetable alert
- Schedule change notifications
- Conflict resolution alerts
- OTP delivery for authentication
- Password reset emails
- System maintenance alerts

**In-App Notifications** (To be built in React)
- Success/Error messages
- Activity feed
- Real-time alerts (polling ready)

### 3.6 Profile Management

**User Profile**
- Profile information editing
- Profile photo upload/change
- Personal contact details
- Department/subject assignment viewing
- Password change option

### 3.7 Chatbot Service

**AI Chatbot Integration**
- FAQ answering capability
- System help support
- Student query handling
- Real-time chat interface

---

## 4. USER ROLES & PERSONAS

### 4.1 Admin (System Administrator)

**Primary Responsibilities:**
- Configure entire academic system
- Manage master data (departments, subjects, faculty, students)
- Generate and publish timetables
- Monitor system health and analytics
- Manage user accounts and permissions

**UI Requirements:**
- Complex dashboard with multiple data sources
- Data tables for CRUD operations
- Advanced filtering and search
- Analytics visualizations (charts, statistics)
- Bulk action support
- Activity log viewer

**Key Pages for Admin:**
- Admin Dashboard (main hub)
- Master Data Management (departments, branches, sections, subjects, faculty, semesters)
- Timetable Generator (with constraint configuration)
- Reports & Analytics (workload, room utilization, conflicts)
- Activity Logs
- User Management
- System Configuration

### 4.2 Faculty

**Primary Responsibilities:**
- View personal teaching schedule
- Manage assigned students/sections (if mentor)
- View student timetables
- Download/share student schedules

**UI Requirements:**
- Personal calendar/timetable view
- Student batch management interface
- Quick access to student information
- Export functionality
- Sharing interface

**Key Pages for Faculty:**
- Faculty Dashboard
- My Timetable (personal schedule)
- My Students (section management)
- Student Timetables (batch management)
- Profile Settings
- Notifications
- Chatbot Assistant

### 4.3 Mentor (Faculty with Extended Access)

**Primary Responsibilities:**
- Manage assigned student section
- View section timetable
- Support student scheduling queries
- Access to departmental analytics

**UI Requirements:**
- Section-specific dashboard
- Section timetable with student list
- Availability management
- Messaging/notification to students

**Key Pages for Mentor:**
- Mentor Dashboard
- Assigned Sections
- Section Timetables
- Student Analytics
- Messaging/Communication

### 4.4 Student

**Primary Responsibilities:**
- View daily/weekly class schedule
- Access course information
- Check timing and location

**UI Requirements:**
- Simple, clean timetable display
- Today's highlight
- Search functionality
- Minimal navigation

**Key Pages for Student:**
- Student Dashboard
- My Timetable (today/week/semester view)
- Subject Details
- Class Timing & Location
- Announcements

---

## 5. UI/UX DESIGN REQUIREMENTS

### 5.1 Visual Design Language

#### 5.1.1 Design Patterns

**Glassmorphism**
- Frosted glass effect with backdrop blur
- Semi-transparent cards (80-85% opacity)
- Border with transparency
- Layered depth with shadows

**Neumorphism**
- Soft, extruded button styles
- Embossed/debossed surfaces
- Light source from top-left
- Minimal shadows with subtle depth

**Gradient Backgrounds**
- Smooth color transitions
- Multi-stop gradients
- Angle-based directional flow
- Animated gradient backgrounds (optional)

**Dark Mode + Light Mode**
- Automatic theme detection
- Manual toggle control
- Smooth transition animations
- Consistent color mapping

**Micro-Interactions**
- Hover state changes (color, scale, shadow)
- Button press animations
- Loading state indicators
- Success/error feedback animations
- Smooth scroll behavior

#### 5.1.2 Layout Components

**Navigation**
- **Sidebar Navigation** (expandable/collapsible)
  - Logo + university branding
  - User avatar with quick access
  - Main menu with icons
  - Submenu support
  - Collapse to icon-only mode
  
- **Top Navigation Bar**
  - Breadcrumb trail
  - Search functionality
  - Notifications bell with count
  - Theme toggle (sun/moon icon)
  - User profile dropdown
  - Quick action buttons

**Page Layout Structure**
- 12-column responsive grid
- Max-width container (1400px)
- Consistent padding and margins
- Breakpoints: 320px, 768px, 1024px, 1280px, 1920px

**Cards & Content Containers**
- Rounded corners (8-16px border-radius)
- Subtle shadows (elevation based)
- Hover lift effects (2-4px translate on hover)
- Transparent borders with glassmorphism

---

### 5.2 Animation & Interaction Design

#### 5.2.1 Page Transitions

- **Fade-in transitions** (300ms) on page load
- **Slide animations** for sidebar navigation
- **Scale animations** for modal dialogs
- **Stagger animations** for list items
- **Skeleton loading** for data fetching

#### 5.2.2 Hover Effects

- **Button hover**: Color shift + scale (1.05x) + shadow increase
- **Card hover**: Shadow elevation + slight lift (2-4px)
- **Link hover**: Color change + underline animation
- **Icon hover**: Rotation + color animation
- **Table row hover**: Background color change + row elevation

#### 5.2.3 Loading & Feedback

- **Loading spinner**: Animated circle (rotating)
- **Skeleton screens**: Placeholder content with pulse animation
- **Success toast**: Green slide-in notification
- **Error toast**: Red shake animation
- **Form validation**: Real-time feedback with icons

#### 5.2.4 Scroll Behavior

- **Smooth scroll**: Enabled globally
- **Scroll-to-top button**: Sticky button in corner
- **Parallax scrolling**: For hero sections
- **Sticky headers**: On data tables

#### 5.2.5 Interactive Cursor

- **Custom animated cursor** (optional 3D effect)
- **Cursor color change** on interactive elements
- **Cursor scale change** on hover
- **Pointer trail animation** (particles follow cursor)

---

### 5.3 Color Palette

#### 5.3.1 Primary Colors

| Color | Hex | Use Case |
|-------|-----|----------|
| Primary Blue | `#0066FF` | Primary buttons, links, active states |
| Primary Purple | `#8B5CF6` | Secondary accent, gradients |
| Primary Orange | `#FF8C42` | Warnings, highlights, CTAs |

#### 5.3.2 Semantic Colors

| Color | Hex | Use Case |
|-------|-----|----------|
| Success Green | `#10B981` | Success messages, completed actions |
| Error Red | `#EF4444` | Errors, destructive actions, alerts |
| Warning Yellow | `#F59E0B` | Warnings, pending states |
| Info Cyan | `#06B6D4` | Information, notifications |

#### 5.3.3 Neutral Colors (Light Mode)

| Color | Hex | Use Case |
|-------|-----|----------|
| Background | `#F9FAFB` | Page background |
| Surface | `#FFFFFF` | Card backgrounds |
| Border | `#E5E7EB` | Borders, dividers |
| Text Primary | `#1F2937` | Main text |
| Text Secondary | `#6B7280` | Secondary text |
| Text Tertiary | `#9CA3AF` | Disabled text |

#### 5.3.4 Neutral Colors (Dark Mode)

| Color | Hex | Use Case |
|-------|-----|----------|
| Background | `#0F172A` | Page background |
| Surface | `#1E293B` | Card backgrounds |
| Border | `#334155` | Borders, dividers |
| Text Primary | `#F1F5F9` | Main text |
| Text Secondary | `#CBD5E1` | Secondary text |
| Text Tertiary | `#64748B` | Disabled text |

---

### 5.4 Typography

#### 5.4.1 Font Stack

**Primary Font**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto`

**Heading Font**: `'Poppins', 'Inter', system-ui`

**Monospace Font**: `'JetBrains Mono', 'Fira Code', monospace`

#### 5.4.2 Font Sizes & Weights

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Display (Hero) | 48px | 700 | 1.2 |
| Heading 1 | 36px | 700 | 1.3 |
| Heading 2 | 28px | 600 | 1.35 |
| Heading 3 | 24px | 600 | 1.4 |
| Title | 20px | 600 | 1.4 |
| Subtitle | 16px | 600 | 1.5 |
| Body Large | 16px | 400 | 1.6 |
| Body | 14px | 400 | 1.6 |
| Body Small | 12px | 400 | 1.5 |
| Caption | 11px | 500 | 1.4 |
| Code | 13px | 400 | 1.6 |

---

### 5.5 Button Styles

#### 5.5.1 Button Variants

**Primary Button**
- Background: Primary Blue
- Color: White
- Hover: Darker blue + scale 1.05 + shadow increase
- Active: Even darker blue
- Disabled: Gray + 50% opacity

**Secondary Button**
- Background: Transparent
- Border: Primary Blue
- Color: Primary Blue
- Hover: Light blue background
- Active: Medium blue background

**Tertiary Button**
- Background: Transparent
- Color: Primary Blue
- Hover: Light blue background
- Active: Medium blue background

**Danger Button**
- Background: Error Red
- Color: White
- Hover: Darker red + scale 1.05
- Active: Even darker red
- Disabled: Gray

**Ghost Button**
- Background: Transparent
- Border: None
- Color: Primary Text
- Hover: Light background
- Active: Medium background

#### 5.5.2 Button States

- **Default**: Full opacity, normal scale
- **Hover**: Scale up (1.05), shadow increase, color shift
- **Active/Pressed**: Scale down (0.95), color darken
- **Disabled**: Opacity 50%, cursor not-allowed
- **Loading**: Spinner animation, disabled state

#### 5.5.3 Button Sizes

- **Large**: 48px height, 16px padding
- **Medium**: 40px height, 14px padding (default)
- **Small**: 32px height, 12px padding
- **Extra Small**: 28px height, 10px padding

---

### 5.6 Form Design

#### 5.6.1 Input Components

**Text Input**
- Border: Subtle gray border
- Focus: Blue border + shadow ring
- Hover: Border color lightens
- Disabled: Background gray, opacity 50%
- Error: Red border + error icon

**Select Dropdown**
- Dropdown arrow icon (chevron)
- Hover state with background change
- Open state with border highlight
- Scrollable with custom styling

**Checkbox**
- Custom checkbox styling (not native)
- Animated check mark animation
- Hover enlargement effect

**Radio Button**
- Custom radio styling
- Animated fill on select
- Hover state with border highlight

**Toggle Switch**
- Animated slide effect
- Color changes on toggle
- Circular indicator with shadow
- Smooth 300ms transition

**Textarea**
- Resizable with min-height: 120px
- Same styling as text input
- Show character count (optional)

#### 5.6.2 Form Layout

- Label placement: Above input
- Spacing: 8px between label and input
- Help text: Small gray text below input
- Error text: Red text with icon
- Required indicator: Red asterisk (*)
- Form field spacing: 16px vertical gap

---

### 5.7 Data Tables

#### 5.7.1 Table Structure

**Header Row**
- Background: Slightly darker than surface
- Text: Bold primary color
- Borders: Bottom border only
- Sortable columns with up/down arrows
- Checkbox for multi-select

**Body Rows**
- Alternating row background (subtle)
- Hover: Full row highlight + elevation
- Borders: Subtle bottom border between rows

**Footer Row** (if pagination)
- Pagination controls
- Rows per page selector
- "Showing X-Y of Z" text

#### 5.7.2 Column Types

**Text Column**
- Left-aligned
- Truncate with ellipsis if too long

**Numeric Column**
- Right-aligned
- Monospace font

**Status Column**
- Badge style with color coding
- Icon + text combination

**Action Column**
- Right-aligned
- Edit, delete, view icons
- Dropdown menu for more actions

#### 5.7.3 Responsive Tables

- Horizontal scroll on mobile
- Card view alternative for mobile
- Sticky first column option
- Collapsible columns on small screens

---

### 5.8 Modal & Dialog Design

#### 5.8.1 Modal Structure

**Modal Header**
- Title text
- Close button (X icon)
- Background: Slightly darker than surface

**Modal Body**
- Padding: 24px
- Content area with form/information
- Scrollable if content exceeds height

**Modal Footer**
- Padding: 16px 24px
- Action buttons (Cancel, Confirm/Save)
- Right-aligned

#### 5.8.2 Modal Animations

- Backdrop: Fade-in 300ms
- Modal: Scale in (0.95 to 1) 300ms
- Exit: Fade-out 200ms

#### 5.8.3 Modal Types

- **Confirmation Dialog**: Simple yes/no
- **Form Modal**: Editable fields
- **Alert Modal**: Information display
- **Loading Modal**: Spinner with message

---

## 6. UI COMPONENTS LIBRARY

### 6.1 Core Components

#### Navigation Components
- `<Navbar />` - Top navigation bar with theme toggle
- `<Sidebar />` - Left sidebar with expandable menu
- `<Breadcrumb />` - Navigation breadcrumb trail
- `<NavLink />` - Navigation link with active state

#### Layout Components
- `<Container />` - Max-width container wrapper
- `<Grid />` - 12-column responsive grid
- `<Section />` - Page section with consistent spacing
- `<Card />` - Reusable card container
- `<PageHeader />` - Page title + description section

#### Button Components
- `<Button />` - Main button component (variants: primary, secondary, danger, ghost)
- `<IconButton />` - Icon-only button
- `<FloatingActionButton />` - Fixed position action button
- `<ButtonGroup />` - Group of related buttons
- `<Dropdown />` - Dropdown button with menu

#### Form Components
- `<Input />` - Text input with validation
- `<Select />` - Dropdown select
- `<Checkbox />` - Checkbox input
- `<Radio />` - Radio button group
- `<Toggle />` - Toggle switch
- `<Textarea />` - Multi-line text input
- `<DatePicker />` - Date selection component
- `<TimePicker />` - Time selection component
- `<FormGroup />` - Form field wrapper
- `<FormError />` - Error message display

#### Data Display Components
- `<Table />` - Data table with sorting/filtering
- `<DataGrid />` - Advanced data grid
- `<List />` - Vertical list display
- `<Badge />` - Status badge
- `<Tag />` - Tag component
- `<Chip />` - Chip/pill component
- `<Avatar />` - User avatar with initials
- `<AvatarGroup />` - Group of avatars

#### Feedback Components
- `<Toast />` - Notification toast (success, error, info)
- `<Alert />` - Alert banner with icon
- `<Modal />` - Modal dialog
- `<Dialog />` - Simple dialog
- `<Tooltip />` - Tooltip on hover
- `<Popover />` - Popover with content
- `<Skeleton />` - Loading skeleton
- `<Spinner />` - Loading spinner

#### Typography Components
- `<Heading />` - H1-H6 headings
- `<Text />` - Paragraph text
- `<Label />` - Form label
- `<Caption />` - Small caption text
- `<Code />` - Inline code display

#### Chart/Visualization Components
- `<LineChart />` - Line chart (Recharts)
- `<BarChart />` - Bar chart
- `<PieChart />` - Pie/Donut chart
- `<AreaChart />` - Area chart
- `<ScatterPlot />` - Scatter plot
- `<Gauge />` - Gauge chart
- `<Heatmap />` - Heatmap visualization

#### 3D Components (Optional)
- `<ThreeDBox />` - 3D rotating box
- `<GlobeVisualization />` - 3D globe (Three.js)
- `<AnimatedBackground />` - 3D animated background

### 6.2 Composite Components

- `<UserCard />` - User profile card
- `<TimetableCard />` - Timetable summary card
- `<StatCard />` - Statistics card with icon
- `<DepartmentCard />` - Department information card
- `<SubjectCard />` - Subject/course card
- `<ClassCard />` - Class/session card
- `<NotificationPanel />` - Notification center
- `<QuickStats />` - Statistics dashboard section
- `<RecentActivity />` - Activity feed component

### 6.3 Layout Patterns

- `<Dashboard />` - Main dashboard layout (sidebar + content)
- `<AuthLayout />` - Login/signup layout
- `<AdminLayout />` - Admin-specific layout with navigation
- `<StudentLayout />` - Student-specific layout
- `<FacultyLayout />` - Faculty-specific layout

---

## 7. PAGE-BY-PAGE DESIGN SPECIFICATIONS

### 7.1 Landing Page (/)

#### Layout
- **Header**: Logo + Navigation (Login/Signup buttons)
- **Hero Section**: Large headline + CTA buttons
- **Features Section**: 3-4 feature cards with icons
- **FAQ Section**: Expandable FAQ accordion
- **Footer**: Links + contact information

#### Components Used
- Navbar, Hero Banner, Feature Cards, FAQ Accordion, Footer

#### Animations
- Hero text fade-in from bottom
- Feature cards stagger animation on scroll
- CTA buttons hover scale effect
- Smooth scroll to sections

#### Interactions
- Click navigation links to sections
- Hover effects on buttons
- Login/Signup button navigation

#### Responsive Design
- Mobile: Full width, stacked layout
- Tablet: 2-column grid for features
- Desktop: 3-4 column grid for features

---

### 7.2 Login Page (/auth/login)

#### Layout
- **Left Section** (Desktop): Brand/branding
- **Right Section**: Login form
- **Mobile**: Centered form above branding

#### Components Used
- Card, Input, Button, Link, Logo

#### Form Fields
1. **Email Input** - with validation (email format)
2. **Role Selection** - Dropdown (Admin, Faculty, Student)
3. **Login Button** - Primary button

#### Animations
- Form fade-in on load
- Input focus: border color change + shadow
- Button hover: scale + shadow increase
- Error message shake animation

#### Interactions
- Email validation on blur
- Role dropdown open/close
- Button click → Call API → Loading spinner → Redirect to OTP page
- "Forgot Password?" link → Redirect to forgot password page
- "Don't have an account?" → Redirect to signup page

#### Validation
- Email required and valid format
- Role required
- Show error messages below inputs

#### Success Flow
- POST /api/auth/login
- Show "OTP sent to your email" message
- Redirect to OTP verification page

---

### 7.3 OTP Verification Page (/auth/otp)

#### Layout
- Centered card with OTP input area
- 6-digit OTP input (auto-advance)
- Resend button with countdown timer

#### Components Used
- Card, OTP Input (custom), Button, Timer, Text

#### Form Fields
1. **OTP Input** - 6 digit boxes (auto-focus next)
2. **Resend Button** - Disabled with countdown (15s default)

#### Animations
- Input boxes scale up on focus
- Successful entry: checkmark animation
- Error: shake animation
- Resend button fade in when available

#### Interactions
- Type digit → Auto-advance to next box
- Delete/backspace → Go back to previous box
- All 6 digits entered → Auto-submit
- Manual submit button
- Click resend → API call → Show countdown → Disable button

#### Error Handling
- Invalid OTP: Shake + error message
- Expired OTP: Show "OTP expired, request new one" + redirect option
- Rate limit: Show "Too many attempts, try again later"

#### Success Flow
- POST /api/auth/verify-login-otp
- Show success toast
- Redirect to dashboard (based on role)

---

### 7.4 Signup Page (/auth/signup)

#### Layout
- **Step 1**: Basic information (email, phone, name, password)
- **Step 2**: Profile details (photo, department, subject)
- **Step 3**: Role selection (Faculty / Mentor)
- **Confirmation**: Review and submit

#### Components Used
- Card, Input, Select, Upload, Radio, Button, StepIndicator

#### Form Fields (Multi-step)

**Step 1:**
1. Full Name - Text input
2. Email - Email input
3. Phone Number - Tel input
4. Password - Password input (with strength indicator)
5. Confirm Password - Password input

**Step 2:**
1. Profile Photo - File upload (drag-drop + click)
2. Department - Select dropdown
3. Subject - Multi-select dropdown
4. Bio - Textarea

**Step 3:**
1. Role Selection - Radio buttons (Faculty / Mentor)

#### Animations
- Step transition: Slide left/right
- Form validation feedback: Inline checkmark/error icon
- Submit button hover: Scale + shadow
- Success toast fade-in

#### Interactions
- Fill form → Next button enables
- Select department → Load subjects
- Upload photo → Show preview
- Submit form → API call → Loading state → Redirect to login

#### Validation
- Email unique check (API call on blur)
- Password strength requirements displayed
- Phone number format validation
- Profile photo size validation (< 5MB)
- Department required
- All steps must be completed

#### Success Flow
- POST /api/auth/signup
- Show "Account created successfully" toast
- Redirect to login page

---

### 7.5 Forgot Password Page (/auth/forgot-password)

#### Layout
- Centered card
- Email input field
- Send OTP button

#### Components Used
- Card, Input, Button, Text

#### Form Fields
1. **Email Input** - Email format validation
2. **Send OTP Button** - Primary button

#### Animations
- Form fade-in
- Success message slide-in

#### Interactions
- Enter email → Send button enables
- Click send → API call → Loading spinner → Show "OTP sent" message
- Redirect to OTP verification page after 2s

#### Validation
- Email required and valid

#### Success Flow
- POST /api/auth/forgot-password
- Show "OTP sent to your email"
- Redirect to /auth/reset-password?email=xxx

---

### 7.6 Password Reset Page (/auth/reset-password)

#### Layout
- Centered card
- OTP input (6 digits)
- New password input
- Confirm password input

#### Components Used
- Card, OTP Input, Input, Button, Text

#### Form Fields
1. **OTP Input** - 6 digit boxes
2. **New Password** - Password input
3. **Confirm Password** - Password input
4. **Reset Button** - Primary button

#### Animations
- Form fade-in
- Successful validation: Checkmark animations

#### Interactions
- Enter OTP → Manual or auto-submit
- Verify OTP → Show password fields
- Enter new password → Show strength indicator
- Click reset → API call → Loading spinner → Success message
- Redirect to login page

#### Validation
- OTP required (6 digits)
- Password required + strength validation
- Passwords must match
- Show inline validation

#### Success Flow
- POST /api/auth/reset-password
- Show "Password reset successfully" toast
- Redirect to login page

---

### 7.7 Admin Dashboard (/dashboard/admin)

#### Layout
- **Sidebar**: Main navigation menu
- **Top Bar**: Breadcrumb, search, notifications, user profile
- **Main Content**: Statistics cards, charts, recent activity

#### Components Used
- Sidebar, Navbar, StatCard, Chart, ActivityFeed, Card

#### Page Sections

**Quick Stats**
- Total Users (Admin, Faculty, Students)
- Total Timetables Generated
- System Health Status
- Total Departments/Sections

**Charts**
- User registration trend (line chart)
- Faculty workload distribution (bar chart)
- Subject distribution (pie chart)
- Department statistics (column chart)

**Recent Activity Feed**
- List of recent system actions
- User logins
- Data modifications
- Timetable generations

**Quick Actions**
- Generate timetable button
- Add new faculty button
- Add new department button
- View reports button

#### Animations
- Stat cards fade-in on load
- Charts animate from 0 to final value
- Activity items stagger animation

#### Interactions
- Click stat card → Show detailed page
- Hover chart → Show tooltip
- Click activity → Show details
- Click action buttons → Redirect to respective pages

#### Responsive Design
- Mobile: Single column, cards stacked
- Tablet: 2-column grid for stats
- Desktop: 4-column grid for stats + charts

---

### 7.8 Master Data Management Pages

All master data pages follow similar pattern:

#### Layout (e.g., Departments)
- **Page Header**: "Departments" title + description
- **Toolbar**: Search, filter, add button, export button
- **Data Table**: List of items with columns for CRUD operations
- **Sidebar Filters** (Optional): Department type, status, etc.

#### Components Used
- PageHeader, SearchBar, Button, Table, Modal, Card

#### Table Features
- Sortable columns
- Searchable content
- Pagination (default 10 items/page)
- Row actions (Edit, Delete, View)
- Multi-select with bulk actions

#### Interactions
- **Add**: Click + button → Modal opens → Fill form → Submit
- **Edit**: Click row → Modal opens → Edit fields → Submit
- **Delete**: Click delete icon → Confirmation dialog → Delete
- **View**: Click row → Detail page / Drawer opens
- **Search**: Filter results in real-time
- **Filter**: Apply filters from sidebar

#### Animations
- Modal slide-up
- Row hover: Lift + highlight
- Delete confirmation: Shake on error
- Success toast: Slide-in

#### Validation
- Required fields validation
- Unique constraint checking
- Show error messages

#### Pages Using This Pattern
- **Departments** (/master/departments)
- **Branches** (/master/branches)
- **Sections** (/master/sections)
- **Subjects** (/master/subjects)
- **Faculty** (/master/faculty)
- **Semesters** (/master/semesters)

---

### 7.9 Department Schedule Configuration

#### Layout
- Form with fields for each semester
- Time slot configuration section
- Break timing section
- Lab block configuration
- Schedule preview section

#### Components Used
- Card, Input, Select, TimePickcer, Button, Table, Modal

#### Form Fields
1. **Department** - Select dropdown
2. **Semester** - Select dropdown
3. **Working Days** - Multi-select checkbox (Mon-Fri, Sat, Sun)
4. **Time Slots** - Table with start/end times
5. **Break Timings** - Table with break durations
6. **Lab Configuration** - Block duration input (default 100 mins)

#### Interactions
- Select department → Load semesters
- Add time slot → Add row to table
- Remove time slot → Delete row
- Save configuration → API call → Show success message
- Preview button → Show visual preview of schedule

#### Validation
- Department required
- At least one working day selected
- At least one time slot
- Time validations (start < end)
- No overlapping time slots

---

### 7.10 Timetable Generator Page (/timetable/generate)

#### Layout
- **Left Panel**: Configuration form
- **Right Panel**: Preview + statistics
- **Bottom**: Generate button + progress indicator

#### Components Used
- Card, Select, Checkbox, Button, ProgressBar, StatCard, Modal

#### Form Fields
1. **Select Department** - Dropdown
2. **Select Semester** - Dropdown
3. **Constraints**:
   - Faculty availability checkbox
   - Room capacity checkbox
   - Minimize gaps checkbox
   - Balanced workload checkbox
   - Lab preferences checkbox
4. **Additional Options**:
   - Randomize schedule checkbox
   - Priority subjects multi-select
   - Excluded time slots multi-select

#### Interactions
- Select department → Load semester options
- Select constraints → Update preview
- Click generate → Show loading state → Algorithm runs
- Success → Show generated timetable + statistics
- Options to:
  - Save timetable
  - Export as PDF/CSV
  - Share with faculty/students
  - Generate again with different constraints

#### Animations
- Form field transitions
- Preview updates with slide animation
- Generation progress bar animation
- Success confetti animation (optional)

#### Validation
- Department required
- Semester required
- At least one constraint selected
- Show validation errors

#### Success Flow
- POST /api/timetable/generate
- Show generated timetable
- Display statistics (conflicts, gaps, workload)
- Show options to save/export/share

---

### 7.11 Timetable Management Page (/timetable/manage)

#### Layout
- **Toolbar**: Search, filter, sort options
- **Tabs**: Active, Archived, History
- **List/Table**: Timetables with metadata
- **Detail Panel** (on selection): Timetable details + actions

#### Components Used
- Tabs, SearchBar, Table, Card, Button, Modal

#### Timetable List Columns
- Timetable ID/Name
- Department
- Semester
- Generated Date
- Generated By
- Status (Active/Archived)
- Actions (View, Edit, Publish, Download, Share, Delete)

#### Interactions
- Click row → Show timetable details
- Click view → Open timetable viewer page
- Click publish → Make visible to faculty/students
- Click download → Generate PDF/CSV export
- Click share → Open share dialog
- Click delete → Confirmation → Delete

#### Animations
- Tab switch: Fade-in transition
- Row hover: Lift effect
- Detail panel slide-in from right

#### Filtering Options
- By department
- By semester
- By status
- By date range

---

### 7.12 Timetable View Page (/timetable/view/:id)

#### Layout
- **Header**: Timetable metadata (department, semester, date)
- **View Options**: Weekly, daily, grid view buttons
- **Toolbar**: Export, print, share buttons
- **Main Content**: Timetable grid or calendar view
- **Details Panel** (on cell click): Class details

#### Components Used
- Card, Button, Grid, Modal, Tooltip, Badge

#### Timetable Grid
- **Rows**: Days of week (Mon-Sun or working days)
- **Columns**: Time slots
- **Cells**: 
  - Subject name (color-coded)
  - Faculty name
  - Section/Batch
  - Room number
  - Class type (Lecture/Lab/Practical)

#### Interactions
- Click cell → Show class details (popup/drawer)
- Hover cell → Show tooltip with full details
- Filter by section/faculty
- Export as image/PDF
- Print timetable
- Share via link/email

#### Animations
- Grid fade-in
- Cell hover: Scale + shadow
- Detail popup: Slide-up animation
- Color-coded subjects with legend

#### Responsive Design
- Mobile: Horizontal scroll table
- Tablet: Card view instead of grid
- Desktop: Full grid view

---

### 7.13 Faculty Timetable Page (/faculty/timetable)

#### Layout
- **Header**: Greeting + current semester
- **View Options**: Week, day, month view
- **Main Content**: Calendar/timetable display
- **Sidebar**: Upcoming classes, statistics

#### Components Used
- Card, Calendar, Badge, StatCard, Sidebar

#### Features
- Today's classes highlighted
- Next 7 days view
- Subject/section filtering
- Export to calendar app
- View student list per class

#### Animations
- Calendar view transitions
- Today highlight animation
- Class cards hover effect

#### Interactions
- Switch view (week/day/month)
- Click class → Show details + student list
- Export → Calendar file download
- Today button → Scroll to today

---

### 7.14 Mentor Dashboard (/mentor/dashboard)

#### Layout
- **Header**: "My Sections" title
- **Section Cards**: Grid of assigned sections
- **Quick Stats**: Student count, class count, etc.

#### Components Used
- Card, Grid, StatCard, Button

#### Section Cards
- Section name
- Student count
- Faculty count
- Next class info
- Actions (View timetable, View students, Manage)

#### Interactions
- Click section → Open section timetable page
- Click manage → Open section management modal

#### Animations
- Cards fade-in on load
- Card hover: Lift + shadow

---

### 7.15 Mentor Section Timetable (/mentor/section/:id)

#### Layout
- **Header**: Section name + metadata
- **Tabs**: Timetable, Students, Analytics
- **Main Content**: Section timetable grid
- **Sidebar**: Student list, class statistics

#### Components Used
- Tabs, Table, Card, Sidebar, Grid

#### Timetable Tab
- Full section timetable grid
- All class details
- Faculty information

#### Students Tab
- List of students in section
- Student details (ID, name, email)
- Filter and search

#### Analytics Tab
- Class count statistics
- Faculty distribution
- Subject distribution

#### Interactions
- Switch tabs
- Click class → Show class details + attendance
- Search/filter students
- Export student list

---

### 7.16 Student Timetable Page (/student/timetable)

#### Layout
- **Header**: "My Classes" title
- **Today's Classes** Section (highlighted)
- **Weekly View**: Calendar grid
- **Class Details** (on click): Popup/drawer

#### Components Used
- Card, Grid, Badge, Popup, Button

#### Features
- Today's classes prominently displayed
- Upcoming classes list
- Class location/room info
- Faculty name
- Subject name
- Timing details

#### Animations
- Today's class card glow effect
- Cards fade-in on load
- Class card hover: Scale + lift

#### Interactions
- View today's classes
- Switch to weekly/monthly view
- Click class → Show full details
- View location on map (optional)
- Add to phone calendar

#### Responsive Design
- Mobile: Stacked card view
- Desktop: Grid view

---

### 7.17 Admin Profile Page (/profile)

#### Layout
- **Profile Header**: Avatar, name, role, email
- **Tabs**: Personal Info, Account Settings, Security
- **Settings Sections**: Edit fields, change password, preferences

#### Components Used
- Card, Input, Avatar, Tabs, Button, Toggle

#### Sections

**Personal Info Tab**
- Edit name, email, phone
- Change profile photo
- Bio/description

**Account Settings Tab**
- Email preferences
- Notification settings
- Theme preference
- Language selection

**Security Tab**
- Change password
- Active sessions list
- Logout from other devices
- 2FA settings (if enabled)

#### Interactions
- Click edit → Enable editing mode
- Upload photo → Show preview
- Save changes → API call → Success message
- Change password → Enter old + new password
- Logout other sessions → Confirmation

#### Animations
- Tab switch: Fade transition
- Form validation: Inline feedback

---

### 7.18 Reports & Analytics Page (/reports)

#### Layout
- **Tab Navigation**: Faculty Workload, Room Utilization, Subject Distribution, Conflicts
- **Filters**: Department, semester, date range
- **Chart Display**: Large chart area
- **Details Table**: Below chart

#### Components Used
- Tabs, SelectFilter, DateRangePicker, Chart, Table, Card

#### Report Types

**Faculty Workload Report**
- Bar chart: Faculty vs hours/week
- Table: Detailed breakdown
- Export option

**Room Utilization Report**
- Heatmap: Room vs utilization %
- Timeline chart: Usage over time
- Room capacity vs actual usage

**Subject Distribution Report**
- Pie chart: Subject distribution
- Table: Subject counts
- Faculty assignment mapping

**Conflict Report**
- List of detected conflicts
- Conflict type (faculty, room, etc.)
- Suggested resolutions

#### Interactions
- Select filters → Chart updates
- Click chart element → Show details
- Export as PDF/CSV/Excel
- Print reports

#### Animations
- Chart animations on load
- Filter transitions
- Data updates with smooth transitions

---

### 7.19 Activity Logs Page (/activity-logs)

#### Layout
- **Toolbar**: Search, filter, date range
- **Activity Table**: Scrollable list
- **Detail Panel** (optional): On row click

#### Components Used
- SearchBar, DateRangePicker, Table, Card, Badge, Pagination

#### Table Columns
- Timestamp
- User (name + role)
- Action (created, updated, deleted)
- Resource Type (department, subject, etc.)
- Details
- IP Address (admin only)

#### Filters
- By user/role
- By action type
- By resource type
- By date range

#### Interactions
- Search logs
- Apply filters
- Click row → Show full details + changes
- Export logs
- Pagination

#### Animations
- Row hover: Highlight
- Detail panel slide-in
- Pagination transitions

---

### 7.20 Student Timetable Sharing Page (Faculty View)

#### Layout
- **Header**: "Share Student Timetable" title
- **Section/Batch Selection**: Dropdown
- **Share Options**: Link, email, QR code
- **Preview**: Generated timetable preview
- **Access Controls**: Expiration date, read-only

#### Components Used
- Select, Button, Input, QRCode, Card, Toggle

#### Features
- Select section to share
- Generate shareable link
- Set expiration date (1 day, 7 days, 30 days, custom)
- Send via email to students
- Generate QR code
- Track who accessed the link

#### Interactions
- Select section → Show preview
- Generate link → Copy to clipboard
- Send email → Modal with email input
- QR code → Display for scanning
- Revoke link → Disable sharing

#### Animations
- Preview updates on section change
- Copy button feedback (checkmark)
- Link generation spinner

---

### 7.21 Chatbot Page (/chatbot)

#### Layout
- **Sidebar**: Chat history list
- **Main Area**: Chat messages conversation
- **Input Area**: Message input with send button
- **Info Panel**: Optional help information

#### Components Used
- Card, MessageBubble, Input, Button, TextArea, Sidebar

#### Features
- Real-time message display
- Bot response animation
- Typing indicator
- Quick action buttons
- Context-aware responses
- Chat history

#### Animations
- Message fade-in
- Typing indicator dots animation
- Message slide-in from bottom
- Quick actions appear with stagger

#### Interactions
- Type message → Send button enables
- Send message → Show in chat + loading state
- Bot response → Animated typing indicator → Response appears
- Click quick action → Insert text
- Clear chat history
- Minimize/maximize chatbot

---

## 8. TIMETABLE UI DESIGN SYSTEM

### 8.1 Timetable Grid Layout

#### Grid Structure
```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│   TIME      │  MON     │  TUE     │  WED     │  THU     │  FRI     │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  08:00-09:00│ Subject1 │ Subject2 │ Subject1 │ Subject3 │ Subject2 │
│             │(Faculty1)│(Faculty2)│(Faculty1)│(Faculty3)│(Faculty2)│
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  09:00-10:00│ Subject2 │ Subject1 │ Subject3 │ Subject2 │ Subject1 │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  10:00-11:00│                    BREAK (30 min)                      │
│             │                                                         │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  11:00-01:00│           LAB (100 min - colspan 2 cells)              │
│             │                                                         │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

#### Cell Types

**Regular Class Cell**
- Subject name (bold, color-coded)
- Faculty name (smaller text)
- Room/Section (icon + room number)
- Duration indicator

**Lab Cell**
- Subject name
- Faculty name
- Room/Lab number
- 100-minute duration indicator
- Spans multiple time slots

**Break Cell**
- "BREAK" label
- Duration
- Background color: Different shade

**Empty Cell**
- Light background
- Faded color

### 8.2 Color Coding System

Each subject gets a unique color from a palette:

| Color | Hex | Use |
|-------|-----|-----|
| Color 1 | `#FF6B6B` | Computer Science |
| Color 2 | `#4ECDC4` | Mathematics |
| Color 3 | `#45B7D1` | Physics |
| Color 4 | `#FFA07A` | Chemistry |
| Color 5 | `#98D8C8` | Biology |
| Color 6 | `#F7DC6F` | English |
| Color 7 | `#BB8FCE` | History |
| Color 8 | `#85C1E2` | Geography |

Subject colors cycle if > 8 subjects.

### 8.3 Cell Interactions

#### Hover State
- Background: Darken by 10%
- Border: Highlight color
- Shadow: Increase
- Cursor: Pointer
- Animation: Scale 1.02

#### Click State
- Show detail popup with full information:
  - Subject name
  - Faculty name (with email)
  - Room/lab details
  - Student list (if faculty view)
  - Attendance (if available)
- Popup position: Above cell

#### Responsive Cell Design
- **Desktop**: Full details in cell
- **Tablet**: Abbreviated details (subject + faculty)
- **Mobile**: Single line (subject name only)

### 8.4 Timetable View Modes

#### Weekly View (Default)
- 7 columns (Mon-Sun) or 5 columns (Mon-Fri)
- Time slots as rows
- Scrollable horizontal and vertical
- Sticky header with day names
- Sticky left column with time slots

#### Daily View
- Single day expanded
- More detailed information per cell
- Larger cells
- Side panel with day summary

#### Monthly View
- Calendar grid
- Each day shows first 2-3 classes
- Click day → Show full day details
- Hover day → Show tooltip with all classes

#### Semester View
- Overview of all classes
- Group by week
- Show class count per day
- Click week → Show weekly timetable

### 8.5 Timetable Export

#### Export Formats
- **PDF**: Formatted timetable document with header/footer
- **CSV**: Spreadsheet format with all details
- **ICS**: Calendar file for importing to Outlook/Google Calendar
- **Image**: PNG snapshot of timetable

#### Export Options
- Choose date range
- Include/exclude empty slots
- Include/exclude faculty details
- Include/exclude room details
- Page orientation (portrait/landscape)

### 8.6 Timetable Features

**Filters**
- By faculty
- By subject
- By room/section
- By class type (lecture/lab)
- Hide empty slots

**Legend**
- Color key for subjects
- Class type icons
- Room capacity indicator

**Statistics Bar**
- Total classes
- Lab hours
- Lecture hours
- Average gap time
- Workload distribution

**Conflict Indicator**
- Red badge for conflicts
- Hover → Show conflict details
- Suggest resolution

---

## 9. DESIGN SYSTEM & BRAND GUIDELINES

### 9.1 Brand Identity

**University Name**: ITM University Gwalior

**Logo**:
- Full logo: "ITM University Gwalior" with emblem
- Shorthand: "ITM" with emblem (square/circular)
- Color: Primary blue or white (on dark backgrounds)

**Brand Colors**:
- **Primary**: `#0066FF` (ITM Blue)
- **Secondary**: `#FF8C42` (Orange accent)
- **Accent**: `#8B5CF6` (Purple)

**Brand Values**:
- Professional
- Educational
- Trustworthy
- Innovative
- Accessible

### 9.2 Typography System

**Font Families**:
- **Headers**: "Poppins", sans-serif
- **Body**: "Inter", sans-serif
- **Monospace**: "JetBrains Mono", monospace

**Font Weights Used**:
- Light: 300
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Extra Bold: 800

**Font Scale** (in pixels):
- 48, 36, 28, 24, 20, 16, 14, 12, 11

### 9.3 Component Specifications

#### Buttons

**Primary Button**
```
- Size: 40px height
- Padding: 8px 16px
- Border radius: 8px
- Font size: 14px, weight: 600
- Background: #0066FF
- Text: White
- Hover: Background #0052CC + scale 1.05
- Active: Background #003D99 + scale 0.95
- Disabled: Opacity 50%
```

**Secondary Button**
```
- Border: 1px solid #0066FF
- Background: Transparent
- Text: #0066FF
- Hover: Background #F0F7FF
```

#### Input Fields

**Standard Input**
```
- Height: 40px
- Padding: 8px 12px
- Border: 1px solid #E5E7EB
- Border radius: 8px
- Font size: 14px
- Focus: Border #0066FF + box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1)
- Error: Border #EF4444
```

#### Cards

**Standard Card**
```
- Border radius: 12px
- Background: White (light mode) / #1E293B (dark mode)
- Box shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
- Hover: Box shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
- Padding: 16px / 20px / 24px (size variants)
- Border: 1px solid #E5E7EB (optional)
```

#### Badges

```
- Border radius: 16px
- Padding: 4px 12px
- Font size: 12px, weight: 600
- Background: Subject color + 20% opacity
- Text: Subject color (darker shade)
```

---

## 10. FRONTEND ARCHITECTURE

### 10.1 Project Structure

```
smart-classroom-frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── assets/
│       ├── images/
│       ├── icons/
│       └── fonts/
├── src/
│   ├── index.js
│   ├── App.jsx
│   ├── components/
│   │   ├── Common/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── ThemeToggle.jsx
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── OTPVerification.jsx
│   │   │   ├── ForgotPassword.jsx
│   │   │   └── ResetPassword.jsx
│   │   ├── Dashboard/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── FacultyDashboard.jsx
│   │   │   ├── MentorDashboard.jsx
│   │   │   └── StudentDashboard.jsx
│   │   ├── MasterData/
│   │   │   ├── Departments.jsx
│   │   │   ├── Branches.jsx
│   │   │   ├── Sections.jsx
│   │   │   ├── Subjects.jsx
│   │   │   ├── Faculty.jsx
│   │   │   └── Semesters.jsx
│   │   ├── Timetable/
│   │   │   ├── TimetableGenerator.jsx
│   │   │   ├── TimetableManagement.jsx
│   │   │   ├── TimetableView.jsx
│   │   │   ├── TimetableGrid.jsx
│   │   │   └── TimetableCell.jsx
│   │   ├── Reports/
│   │   │   ├── FacultyWorkloadReport.jsx
│   │   │   ├── RoomUtilizationReport.jsx
│   │   │   ├── SubjectDistributionReport.jsx
│   │   │   └── ConflictReport.jsx
│   │   ├── UI/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Toast.jsx
│   │   │   ├── Avatar.jsx
│   │   │   └── Badge.jsx
│   │   └── 3D/
│   │       ├── AnimatedBackground.jsx
│   │       ├── RotatingBox.jsx
│   │       └── GlobeVisualization.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── FacultyTimetable.jsx
│   │   ├── StudentTimetable.jsx
│   │   ├── MasterData.jsx
│   │   ├── Reports.jsx
│   │   ├── Profile.jsx
│   │   └── NotFound.jsx
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── ThemeContext.jsx
│   │   ├── NotificationContext.jsx
│   │   └── UserContext.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useTheme.js
│   │   ├── useFetch.js
│   │   ├── useForm.js
│   │   └── useNotification.js
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── masterDataService.js
│   │   ├── timetableService.js
│   │   └── reportService.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── dateUtils.js
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── helpers.js
│   ├── styles/
│   │   ├── globals.css
│   │   ├── variables.css
│   │   ├── animations.css
│   │   ├── components/
│   │   │   ├── button.css
│   │   │   ├── card.css
│   │   │   ├── input.css
│   │   │   └── table.css
│   │   └── pages/
│   │       ├── dashboard.css
│   │       ├── timetable.css
│   │       └── auth.css
│   ├── config/
│   │   ├── api.config.js
│   │   └── theme.config.js
│   └── assets/
│       ├── icons/
│       ├── images/
│       └── animations/
├── .env.example
├── .gitignore
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

### 10.2 Component Architecture

**Base Component Pattern**:
```jsx
// src/components/UI/Button.jsx
import React from 'react';
import './Button.css'; // or tailwind classes

const Button = ({ 
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  children,
  ...props 
}) => {
  return (
    <button 
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? <Spinner size="small" /> : children}
    </button>
  );
};

export default Button;
```

### 10.3 State Management

**Using Context API**:
```jsx
// src/context/AuthContext.jsx
import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const login = (userData) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 10.4 Custom Hooks

**useAuth.js**:
```jsx
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 10.5 API Service Layer

**services/api.js**:
```jsx
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle token expiry
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 11. TECHNOLOGY STACK & LIBRARIES

### 11.1 Core Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.x",
  "axios": "^1.x"
}
```

### 11.2 UI & Styling

```json
{
  "tailwindcss": "^3.x",
  "@tailwindcss/forms": "^0.5.x",
  "@tailwindcss/typography": "^0.5.x",
  "postcss": "^8.x",
  "autoprefixer": "^10.x"
}
```

### 11.3 Animation Libraries

```json
{
  "framer-motion": "^10.x",
  "react-transition-group": "^4.x",
  "gsap": "^3.x"
}
```

### 11.4 3D Libraries

```json
{
  "three": "^r130+",
  "react-three-fiber": "^8.x",
  "@react-three/drei": "^9.x",
  "@react-three/postprocessing": "^2.x"
}
```

### 11.5 Charts & Data Visualization

```json
{
  "recharts": "^2.x",
  "react-apexcharts": "^1.x",
  "chart.js": "^4.x",
  "react-chartjs-2": "^5.x"
}
```

### 11.6 Form & Validation

```json
{
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "@hookform/resolvers": "^3.x"
}
```

### 11.7 UI Component Libraries (Optional)

```json
{
  "daisyui": "^3.x",
  "headlessui": "^1.x",
  "radix-ui": "^latest"
}
```

### 11.8 Utils & Helpers

```json
{
  "date-fns": "^2.x",
  "lodash-es": "^4.x",
  "clsx": "^2.x",
  "zustand": "^4.x"
}
```

### 11.9 Dev Dependencies

```json
{
  "vite": "^4.x",
  "@vitejs/plugin-react": "^4.x",
  "eslint": "^8.x",
  "prettier": "^3.x"
}
```

---

## 12. NON-FUNCTIONAL REQUIREMENTS

### 12.1 Performance

- **Initial Page Load**: < 2 seconds (Lighthouse measure)
- **Time to Interactive**: < 3.5 seconds
- **Animation Frame Rate**: 60fps (no jank)
- **Bundle Size**: < 500KB gzipped
- **Lighthouse Scores**:
  - Performance: > 90
  - Accessibility: > 85
  - Best Practices: > 90
  - SEO: > 90

### 12.2 Responsiveness

- **Mobile Breakpoint**: 320px - 768px
- **Tablet Breakpoint**: 768px - 1024px
- **Desktop Breakpoint**: 1024px - 1440px
- **Large Desktop**: 1440px+
- **Touch Target Size**: Minimum 44x44px
- **Orientation**: Support portrait and landscape

### 12.3 Accessibility

- **WCAG 2.1 AA Compliance**
- **Color Contrast Ratio**: Minimum 4.5:1 for text
- **Keyboard Navigation**: All functionality accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Indicators**: Clear and visible
- **Alternative Text**: For all images

### 12.4 Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: Latest versions
- No IE11 support (EOL)

### 12.5 Security

- **HTTPS**: All communications encrypted
- **CSRF Protection**: Token-based
- **XSS Prevention**: Content sanitization
- **Authentication**: JWT tokens with refresh mechanism
- **Input Validation**: Client-side validation + server-side
- **API Rate Limiting**: Implemented on backend
- **Data Privacy**: No sensitive data in localStorage beyond necessary tokens

### 12.6 SEO

- **Meta Tags**: Proper title, description, keywords
- **Open Graph**: For social sharing
- **Sitemap**: XML sitemap for indexing
- **Robots.txt**: Proper crawling rules
- **Canonical URLs**: Avoid duplicate content
- **Mobile-Friendly**: Mobile-first design

### 12.7 Maintainability

- **Code Style**: ESLint + Prettier
- **Component Documentation**: JSDoc comments
- **Git History**: Meaningful commit messages
- **Modular Structure**: Reusable components
- **Environment Variables**: Proper .env configuration
- **Error Logging**: Centralized error tracking (Sentry optional)

### 12.8 Scalability

- **Component Reusability**: DRY principle
- **State Management**: Proper context/store organization
- **API Abstraction**: Service layer for API calls
- **Lazy Loading**: Code splitting for routes
- **Data Pagination**: Infinite scroll or page-based

---

## 13. MIGRATION STRATEGY

### 13.1 Frontend-Only Migration

**Backend Remains Unchanged**:
- ✅ All Node.js/Express APIs unchanged
- ✅ PostgreSQL database unchanged
- ✅ Authentication flow remains same
- ✅ Email system unchanged

### 13.2 API Compatibility

All React components will call existing backend APIs:
- `/api/auth/*` - Authentication endpoints
- `/api/master/*` - Master data endpoints
- `/api/timetable/*` - Timetable endpoints
- `/api/reports/*` - Reports endpoints
- `/api/faculty/*` - Faculty endpoints
- `/api/mentor/*` - Mentor endpoints

### 13.3 Migration Phases

**Phase 1: Setup & Infrastructure**
- Initialize React project with Vite
- Setup Tailwind CSS + animations
- Create component library
- Setup routing and state management

**Phase 2: Core Pages**
- Landing page
- Authentication pages (login, signup, OTP)
- Password reset flow
- Profile page

**Phase 3: Admin Features**
- Admin dashboard
- Master data management (CRUD pages)
- Timetable generator
- Timetable viewer

**Phase 4: Faculty & Mentor Features**
- Faculty dashboard
- Faculty timetable
- Mentor dashboard
- Section management

**Phase 5: Student Features**
- Student dashboard
- Student timetable viewer
- Notification system

**Phase 6: Advanced Features**
- Reports and analytics
- 3D visualizations
- Chatbot integration
- Dark mode polish

### 13.4 Testing Strategy

- **Unit Tests**: React components with Jest + React Testing Library
- **Integration Tests**: Component interactions
- **E2E Tests**: Full user flows with Cypress
- **Visual Tests**: Screenshot comparison
- **Performance Tests**: Lighthouse audits

### 13.5 Deployment

- **Build Tool**: Vite (optimized production build)
- **Hosting**: Same server as backend (serve from `/frontend` folder)
- **Environment Variables**: API_URL, theme defaults
- **Monitoring**: Browser error tracking + performance metrics

---

## 14. FUTURE SCOPE

### 14.1 Phase 2 Enhancements

**AI-Powered Features**
- Intelligent timetable suggestions
- Conflict prediction and prevention
- Smart scheduling recommendations
- Workload balancing AI

**Advanced Analytics**
- Predictive analytics for student performance
- Resource forecasting
- Trend analysis

**Mobile App**
- Native iOS/Android app using React Native
- Push notifications
- Offline timetable viewing

**Real-Time Features**
- WebSocket integration for live updates
- Real-time collaboration on timetable editing
- Live notification system

### 14.2 UI Enhancements

**Advanced 3D Features**
- 3D campus visualization
- Room availability heatmap in 3D
- Interactive 3D timetable representation

**Drag & Drop Enhancements**
- Drag-drop timetable editor
- Manual conflict resolution UI
- Batch assignment drag-drop

**Collaboration Features**
- Comment/discussion on timetable issues
- Approval workflow for schedule changes
- Faculty consensus builder

**Integration Features**
- Google Calendar sync
- Outlook integration
- Microsoft Teams integration
- Slack notifications

### 14.3 Performance Optimizations

- Service Worker for offline support
- Advanced caching strategies
- Preloading critical resources
- Image optimization and CDN integration

---

## 15. APPENDICES

### Appendix A: API Endpoints Reference

**Authentication**
- `POST /api/auth/login`
- `POST /api/auth/verify-login-otp`
- `POST /api/auth/signup`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`

**Master Data (Admin)**
- `GET/POST /api/master/departments`
- `GET/POST /api/master/branches`
- `GET/POST /api/master/sections`
- `GET/POST /api/master/subjects`
- `GET/POST /api/master/faculty`
- `GET/POST /api/master/semesters`

**Timetable**
- `POST /api/timetable/generate`
- `GET /api/timetable/list`
- `GET /api/timetable/:id`
- `POST /api/timetable/:id/publish`

**Faculty**
- `GET /api/faculty/timetable`
- `GET /api/faculty/student-timetable`
- `POST /api/faculty/student-timetable/share`

**Reports**
- `GET /api/reports/faculty-workload`
- `GET /api/reports/room-utilization`
- `GET /api/reports/conflicts`

### Appendix B: Color Palette & Component Tokens

[Design tokens JSON to be provided to Figma/Storybook]

### Appendix C: Animations Library

[Reusable animation definitions using Framer Motion and GSAP]

### Appendix D: Accessibility Checklist

- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility
- [ ] Color contrast validated
- [ ] ARIA labels added
- [ ] Focus indicators visible
- [ ] Form labels associated
- [ ] Error messages descriptive
- [ ] Mobile accessibility verified

---

**Document Status**: READY FOR AI UI GENERATION  
**Last Reviewed**: 2025-05-04  
**Next Review**: Upon feature completion

---
