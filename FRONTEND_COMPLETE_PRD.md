# 🎓 SMART CLASSROOM TIMETABLE SCHEDULER
## Frontend Redesign - Complete PRD

**Version**: 2.0 (Comprehensive Single Document)  
**Focus**: Practical Frontend Implementation  
**Stack**: React + Tailwind CSS + Modern UI  
**Date**: 2025-05-04

---

## 📋 TABLE OF CONTENTS

1. [Current Issues](#1-current-issues)
2. [Design Vision](#2-design-vision)
3. [Role-Based UI Strategy](#3-role-based-ui-strategy)
4. [UI/UX Standards](#4-uiux-standards)
5. [Component Library](#5-component-library)
6. [Page Specifications](#6-page-specifications)
7. [Navigation & Layout](#7-navigation--layout)
8. [Timetable Design](#8-timetable-design)
9. [Forms & Data Entry](#9-forms--data-entry)
10. [Color & Typography](#10-color--typography)
11. [Responsive Design](#11-responsive-design)
12. [Animations & Interactions](#12-animations--interactions)
13. [Code Architecture](#13-code-architecture)
14. [Implementation Checklist](#14-implementation-checklist)

---

## 1. CURRENT ISSUES

### Problems with Existing UI
- ❌ Basic Bootstrap styling, not modern
- ❌ Same layout for all roles (not role-optimized)
- ❌ No consistent visual hierarchy
- ❌ Boring tables without visual appeal
- ❌ No dark mode support
- ❌ Slow/laggy interactions
- ❌ Poor mobile experience
- ❌ Not presentable for professional use

### What Needs to Change
- ✅ Modern, clean interface
- ✅ Role-specific dashboards (Admin ≠ Faculty ≠ Student)
- ✅ Professional visual design
- ✅ Smooth animations
- ✅ Dark mode support
- ✅ Fast & responsive
- ✅ Hackathon-ready quality

---

## 2. DESIGN VISION

### Core Design Principles

**1. Effectiveness Over Aesthetics**
- Every element serves a purpose
- Information hierarchy is clear
- Admin sees power/control
- Faculty sees ease/simplicity
- Student sees clarity/focus

**2. Consistent Across Roles**
- Same design language for all
- Different layouts/features per role
- Smooth transitions between sections
- Unified color scheme

**3. Modern & Professional**
- Glassmorphism effects (optional)
- Smooth animations (150-300ms)
- Professional color palette
- Clean typography
- Proper spacing

**4. Fast & Efficient**
- Quick loading (< 2s)
- Smooth 60fps animations
- Responsive to user input
- Mobile-optimized

---

## 3. ROLE-BASED UI STRATEGY

### ADMIN Dashboard
**Focus**: Control, data, analytics

**Key Elements**:
- Large statistics cards (prominent)
- Multiple data tables with filters
- Chart visualizations
- Quick action buttons
- Bulk operations support
- Advanced search

**Color Tone**: Blue (authority), confident, powerful

**Layout**:
```
┌─────────────────────────────────────┐
│ Navigation Sidebar (Always visible) │
├─────────────┬───────────────────────┤
│             │                       │
│   SIDEBAR   │     MAIN CONTENT      │
│             │                       │
│  - Summary  │  ┌─────────────────┐  │
│  - Academic │  │ Stat Cards (4)  │  │
│  - Timetable│  ├─────────────────┤  │
│  - Reports  │  │ Data Tables     │  │
│  - Logs     │  │ with Filters    │  │
│             │  ├─────────────────┤  │
│             │  │ Charts/Reports  │  │
│             │  └─────────────────┘  │
└─────────────┴───────────────────────┘
```

**Pages**:
- Summary (Stats + Quick Actions)
- Academic Data (CRUD: Departments, Branches, Sections, Subjects, Faculty, Semesters)
- Timetable (Generator + History)
- Reports (Workload, Room Utilization, Conflicts)
- Activity Logs (Audit trail)

---

### FACULTY Dashboard
**Focus**: Personal timetable, students, management

**Key Elements**:
- Personal calendar/schedule
- Student batch list
- Quick stats (my classes, my students)
- Minimal navigation
- One-click actions

**Color Tone**: Green/Teal (friendly, approachable)

**Layout**:
```
┌─────────────────────────────────────┐
│      Top Navigation Bar             │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐   │
│  │ My Stats (3 cards)          │   │
│  │ - Classes Today             │   │
│  │ - Total Students            │   │
│  │ - Upcoming Classes          │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ My Timetable (This Week)    │   │
│  │ [Calendar Grid View]         │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ My Students (Quick List)     │   │
│  │ [Batch listing]              │   │
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Pages**:
- My Dashboard (Summary + Calendar)
- My Timetable (Personal schedule)
- My Students (Batch management)
- Student Timetables (Share/View)
- Profile Settings

---

### STUDENT Dashboard
**Focus**: Today's classes, timing, location

**Key Elements**:
- Today's classes (highlighted)
- Simple calendar
- Class details (timing, room, faculty)
- Very minimal interface
- Large, easy-to-read text

**Color Tone**: Orange/Purple (energetic, student-friendly)

**Layout**:
```
┌─────────────────────────────────────┐
│      Simple Top Bar                 │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────────────────────┐   │
│  │ TODAY'S CLASSES (LARGE)      │   │
│  │                              │   │
│  │ Class 1: 9:00 AM - Room 101  │   │
│  │ Class 2: 10:30 AM - Room 102 │   │
│  │ Class 3: 1:00 PM - Room 103  │   │
│  │                              │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ This Week (Simple View)      │   │
│  │ [Calendar]                   │   │
│  └──────────────────────────────┘   │
│                                     │
```

**Pages**:
- My Classes (Today + Calendar)
- Full Timetable (Week/Month view)
- Class Details (on click)
- Profile (minimal)

---

## 4. UI/UX STANDARDS

### Color Palette

**Primary Colors**:
```
Admin:    #0066FF (Blue)     - Authority, control
Faculty:  #10B981 (Green)    - Friendly, approachable
Student:  #FF8C42 (Orange)   - Energetic, youthful
```

**Semantic Colors**:
```
Success:   #10B981 (Green)
Error:     #EF4444 (Red)
Warning:   #F59E0B (Yellow/Orange)
Info:      #06B6D4 (Cyan)
Neutral:   #6B7280 (Gray)
```

**Dark Mode Colors**:
```
Background:  #0F172A
Surface:     #1E293B
Text Primary: #F1F5F9
Text Secondary: #CBD5E1
Border:      #334155
```

**Subject Colors (Timetable)**:
```
Color 1: #FF6B6B (Red)
Color 2: #4ECDC4 (Teal)
Color 3: #45B7D1 (Blue)
Color 4: #FFA07A (Salmon)
Color 5: #98D8C8 (Mint)
Color 6: #F7DC6F (Yellow)
Color 7: #BB8FCE (Purple)
Color 8: #85C1E2 (Sky Blue)
```

### Typography

**Font Families**:
```
Headers:   'Poppins' or 'Inter Bold'
Body:      'Inter'
Monospace: 'JetBrains Mono'
```

**Font Sizes**:
```
Heading 1: 36px (700 weight)
Heading 2: 28px (600 weight)
Heading 3: 24px (600 weight)
Title:     20px (600 weight)
Body:      16px (400 weight)
Small:     14px (400 weight)
Caption:   12px (500 weight)
```

**Line Heights**:
```
Headings: 1.2-1.3
Body:     1.6
Labels:   1.4
```

### Spacing

**Scale**:
```
4px   (xs)
8px   (sm)
12px  (md)
16px  (lg)
20px  (xl)
24px  (2xl)
32px  (3xl)
```

**Common Usage**:
```
Page padding:     24px
Card padding:     20px
Section gap:      16px
Element gap:      12px
Button padding:   8px 16px
Input padding:    8px 12px
```

### Border Radius

```
Buttons:   8px
Inputs:    8px
Cards:     12px
Modals:    16px
Subtle:    6px
```

### Shadow System

```
Subtle:    0 1px 3px rgba(0,0,0,0.1)
Small:     0 4px 6px rgba(0,0,0,0.1)
Medium:    0 10px 15px rgba(0,0,0,0.1)
Large:     0 20px 25px rgba(0,0,0,0.15)
Hover:     0 10px 25px rgba(0,0,0,0.15)
```

---

## 5. COMPONENT LIBRARY

### Reusable Components

#### Navigation
- **Sidebar** - Collapsible navigation (Admin)
- **Navbar** - Top navigation bar
- **Breadcrumb** - Navigation path
- **Tabs** - Section switching
- **Dropdown Menu** - Actions menu

#### Buttons
- **Primary Button** - Main action (use role color)
- **Secondary Button** - Alternative action
- **Icon Button** - Icon-only actions
- **Floating Button** - Quick actions
- **Button Group** - Related buttons

#### Forms
- **Text Input** - Single-line text
- **Email Input** - Email validation
- **Password Input** - Secure input
- **Select Dropdown** - Predefined options
- **Multi-Select** - Multiple choices
- **Checkbox** - Boolean option
- **Radio Button** - Single choice group
- **Toggle Switch** - On/Off
- **Textarea** - Multi-line text
- **Date Picker** - Date selection
- **Time Picker** - Time selection
- **Form Group** - Label + Input wrapper

#### Data Display
- **Table** - Sortable, filterable data
- **Card** - Information container
- **Badge** - Status indicator
- **Avatar** - User profile picture
- **Stat Card** - Number + label display
- **List** - Vertical item listing
- **Grid** - Multi-column layout

#### Feedback
- **Toast** - Success/error message
- **Alert** - Important notification
- **Modal** - Dialog box
- **Loading Spinner** - Loading state
- **Skeleton Screen** - Content placeholder
- **Progress Bar** - Completion indicator

#### Charts
- **Line Chart** - Trend visualization
- **Bar Chart** - Comparison data
- **Pie Chart** - Distribution
- **Area Chart** - Over-time data

---

## 6. PAGE SPECIFICATIONS

### ADMIN PAGES

#### 1. Admin Login Page
```
Layout: Centered card
Content:
  - University logo
  - Email input
  - Role selector (Admin)
  - Login button
  - Forgot password link
  
Style:
  - Background gradient
  - Card with shadow
  - Role color accent (Blue)
```

#### 2. Admin Dashboard
```
Layout: Sidebar + Content
Sections:
  
  A) Summary (Default)
     - 4 Stat Cards (Users, Departments, Timetables, Active)
     - Quick Action Buttons
     - Recent Activity Feed
     
  B) Academic Data Management
     - Tabbed interface
     - CRUD tables for:
       * Departments
       * Branches
       * Sections
       * Subjects
       * Faculty
       * Semesters
     - Each table has:
       * Search box
       * Filters
       * Sort options
       * Add/Edit/Delete buttons
       
  C) Timetable
     - Generator form (Department → Semester → Generate)
     - Constraints checkboxes
     - Generated timetable preview
     - Save/Export options
     - History tab
     
  D) Reports
     - Faculty Workload chart
     - Room Utilization heatmap
     - Subject Distribution pie chart
     - Conflict Report list
     
  E) Activity Logs
     - Filterable log table
     - Timestamp, User, Action, Resource
     - Export logs
```

#### 3. Admin Profile
```
Layout: Centered card
Content:
  - Profile picture (upload)
  - Name, Email, Phone
  - Change password
  - Logout
  
Style:
  - Simple, functional
```

---

### FACULTY PAGES

#### 1. Faculty Dashboard
```
Layout: Full width, no sidebar
Content:
  
  A) Header
     - Welcome message
     - Date/Time
     - Quick stats (3 cards):
       * Classes Today
       * Total Students
       * Upcoming Classes
     
  B) My Timetable
     - Calendar grid (Mon-Fri, time slots)
     - Color-coded subjects
     - Today highlighted
     - Click to see details
     
  C) My Students
     - List/Card view toggle
     - Search by batch
     - Student count per batch
     - Quick actions (view timetable)
     
  D) Quick Links
     - View Student Timetables
     - My Profile
     - Share Timetable
     - Logout

Style:
  - Green/Teal accent (Faculty color)
  - Friendly, not overwhelming
```

#### 2. Faculty Timetable (Detailed)
```
Layout: Full width
Content:
  - Header: "My Teaching Schedule"
  - Date range selector
  - View options (Week/Month)
  - Timetable grid
  - Filters (Subject, Section)
  - Export button
```

#### 3. Faculty Student Timetables
```
Layout: Full width
Content:
  - Section selector
  - Timetable preview
  - Share button (creates link)
  - Download as PDF
  - Share via email
  - View analytics
```

#### 4. Faculty Profile
```
Layout: Centered card
Content:
  - Name, Email, Phone
  - Department, Subjects
  - Profile picture
  - Change password
  - Logout
```

---

### STUDENT PAGES

#### 1. Student Dashboard
```
Layout: Full width, minimal nav
Content:
  
  A) Header
     - "My Classes Today"
     - Large, prominent
     
  B) Today's Classes
     - Large cards for each class
     - Time, Room, Subject, Faculty
     - Next class highlighted
     
  C) This Week
     - Compact calendar view
     - Clickable to see day details
     
  D) All Classes
     - Month view calendar
     - Class indicator dots

Style:
  - Orange/Purple accent (Student color)
  - Large readable text
  - Minimal distractions
```

#### 2. Student Full Timetable
```
Layout: Full width
Content:
  - Title: "My Timetable"
  - View options (Week/Month/Semester)
  - Timetable grid
  - Search/filter subjects
  - Color legend
  - Simple, clean

Style:
  - Easy to read
  - Large text
  - Minimal UI elements
```

#### 3. Student Profile
```
Layout: Centered card
Content:
  - Name, Roll Number
  - Semester, Section
  - Email, Phone
  - Change password
  - Logout
```

---

## 7. NAVIGATION & LAYOUT

### Sidebar Navigation (Admin Only)

```
┌─────────────────────┐
│  Logo | ITM         │
├─────────────────────┤
│ ⊕ Summary          │
│                     │
│ ⊕ Academic Data    │
│   ├─ Departments   │
│   ├─ Branches      │
│   ├─ Sections      │
│   ├─ Subjects      │
│   ├─ Faculty       │
│   └─ Semesters     │
│                     │
│ ⊕ Timetable        │
│   ├─ Generate      │
│   ├─ History       │
│   └─ View          │
│                     │
│ ⊕ Reports          │
│   ├─ Workload      │
│   ├─ Utilization   │
│   ├─ Distribution  │
│   └─ Conflicts     │
│                     │
│ ⊕ Activity Logs    │
│                     │
│ ─────────────────── │
│ [User Menu]         │
│ [Settings]          │
│ [Logout]            │
└─────────────────────┘
```

**Features**:
- Collapse/Expand toggle
- Active state highlighting
- Hover effects
- Smooth transitions (200ms)

### Top Navigation (All Roles)

```
┌──────────────────────────────────────────────┐
│ [Menu] Logo | Role | Search | [Bell] [User] │
└──────────────────────────────────────────────┘
```

**Elements**:
- Menu toggle (mobile)
- Logo/Brand
- Current role/view
- Search box (if applicable)
- Notifications bell
- User dropdown (Profile, Settings, Logout)

### Responsive Breakpoints

```
Mobile:    320px - 640px   → Single column, full width
Tablet:    641px - 1024px  → 2 columns, stacked nav
Desktop:   1025px - 1440px → Full layout with sidebar
Large:     1441px+         → Max-width container
```

---

## 8. TIMETABLE DESIGN

### Grid Structure

```
┌──────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ TIME │  MON     │  TUE     │  WED     │  THU     │  FRI     │
├──────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 8:00 │ Subject1 │ Subject2 │ Subject1 │ Subject3 │ Subject2 │
│      │ Fac1     │ Fac2     │ Fac1     │ Fac3     │ Fac2     │
│      │ Room101  │ Room102  │ Room101  │ Lab01    │ Room102  │
├──────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 9:00 │ Subject2 │ Subject1 │ Subject3 │ Subject2 │ Subject1 │
│      │ ...      │ ...      │ ...      │ ...      │ ...      │
├──────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│10:00 │          │          │ LAB (100 min - spans 2 slots)  │
│      │   BREAK  │  BREAK   │ Subject4 │ Fac4     │ Lab02    │
│11:00 │          │          │          │          │          │
├──────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│ etc...                                                        │
└──────────────────────────────────────────────────────────────┘
```

### Cell Design

**Regular Class Cell**:
```
┌─────────────────┐
│ SUBJECT NAME    │ (Bold, color-coded)
│ Faculty Name    │ (Smaller text)
│ Room 101        │ (Icon + room number)
└─────────────────┘
```

**Lab Cell** (100+ minutes):
```
┌─────────────────────────────────┐
│ LAB: SUBJECT NAME (100 min)     │
│ Faculty Name | Lab02            │
└─────────────────────────────────┘
(Spans 2+ time slots)
```

**Break Cell**:
```
┌─────────────────┐
│ BREAK           │
│ 10:00 - 10:30   │
└─────────────────┘
```

### Interactions

**Hover**:
- Highlight with shadow
- Scale up slightly (1.02x)
- Show cursor pointer

**Click**:
- Show popup/modal with:
  - Full class details
  - Faculty info + email
  - Room details
  - Student list (if faculty view)

**Colors**:
- Each subject gets unique color from palette
- Consistent throughout system
- Color legend at bottom/side

### Responsive Timetable

**Mobile** (< 640px):
```
- Horizontal scroll
- Compact time slots
- Subject abbreviations
- Side legend
```

**Tablet** (641-1024px):
```
- Full grid with padding
- Normal text
- Hover effects work
```

**Desktop** (1025px+):
```
- Full detailed grid
- Sticky headers
- All interactions available
```

---

## 9. FORMS & DATA ENTRY

### Form Standards

**Layout**:
- Vertical stacking (responsive)
- Label above input
- 8px gap between label and input
- 16px gap between fields
- 24px gap between sections

**Input Fields**:

```
Label (14px, 500 weight)
[Input Box] ← 40px height, 12px padding
Help text (12px, gray)
Error text (12px, red, with icon)
```

**Button Placement**:
- Primary button on left
- Secondary button on right
- Minimum 40px height
- Minimum 16px padding

### CRUD Operations

**Create/Add**:
```
1. Click "Add New" button
2. Modal/Page opens
3. Form with fields
4. Validation on change
5. Submit creates item
6. Success toast shown
7. List refreshes
```

**Read/View**:
```
1. Click row in table
2. Detail view shows
3. All info readable
4. Edit/Delete buttons available
```

**Update/Edit**:
```
1. Click Edit button
2. Modal/Page opens with data pre-filled
3. Modify fields
4. Submit updates
5. Success toast
6. List refreshes
```

**Delete**:
```
1. Click Delete button
2. Confirmation dialog
3. If confirmed, delete
4. Success toast
5. Item removed from list
```

---

## 10. COLOR & TYPOGRAPHY

### Color Usage Guide

**By Role**:
```
Admin:    #0066FF (Blue)
Faculty:  #10B981 (Green)
Student:  #FF8C42 (Orange)
```

**By Status**:
```
Active:    #10B981 (Green)
Pending:   #F59E0B (Yellow)
Error:     #EF4444 (Red)
Inactive:  #9CA3AF (Gray)
```

**Text Hierarchy**:
```
Primary:   #1F2937 (Dark gray) - Main text
Secondary: #6B7280 (Gray)      - Secondary info
Tertiary:  #9CA3AF (Light gray)- Disabled/hint
```

### Typography Examples

**Page Header**:
```
Poppins, 36px, 700 weight, #1F2937
Line height: 1.3
```

**Section Title**:
```
Poppins, 24px, 600 weight, #1F2937
Line height: 1.4
```

**Body Text**:
```
Inter, 16px, 400 weight, #1F2937
Line height: 1.6
```

**Small Text/Helper**:
```
Inter, 14px, 400 weight, #6B7280
Line height: 1.5
```

**Button Text**:
```
Inter, 14px, 600 weight, #FFFFFF
```

---

## 11. RESPONSIVE DESIGN

### Mobile (320px - 640px)

**Navigation**:
- Hamburger menu (collapsed sidebar)
- Full-width top bar
- Menu drawer on left

**Layout**:
- Single column
- Full width content
- Stacked cards

**Forms**:
- Full width inputs
- Vertical button stack
- Large touch targets (44x44px)

**Tables**:
- Horizontal scroll
- Card view alternative
- Simplified columns

### Tablet (641px - 1024px)

**Navigation**:
- Compact sidebar (can collapse)
- Top navigation bar
- Combined navigation

**Layout**:
- 2-column grid
- Flexible content
- Adaptive cards

**Forms**:
- 2-column on large tablet
- Responsive inputs

**Tables**:
- Full table display
- Scrollable if needed

### Desktop (1025px+)

**Navigation**:
- Full sidebar (always visible)
- Top navigation bar
- Optimal layout

**Layout**:
- Multi-column
- Max-width 1400px
- Spacious cards

**Forms**:
- Multiple columns
- Optimized spacing

**Tables**:
- Full display
- All features visible

---

## 12. ANIMATIONS & INTERACTIONS

### Transition Timings

```
Fast:     150ms - Micro-interactions (hover states)
Normal:   200ms - Component transitions
Slow:     300ms - Page/modal transitions
Easing:   ease-out (snappy feel)
```

### Common Animations

**Button Hover**:
```
- Scale: 1 → 1.05
- Shadow: Subtle → Pronounced
- Duration: 150ms
- Easing: ease-out
```

**Button Press**:
```
- Scale: 1.05 → 0.95
- Duration: 100ms
- Easing: ease-out
```

**Modal Open**:
```
- Backdrop: Fade in (200ms)
- Modal: Slide up or Scale in (300ms)
- Easing: ease-out
```

**Page/Tab Change**:
```
- Fade out (150ms)
- Load content
- Fade in (200ms)
- Total: ~300ms
```

**Hover on Table Row**:
```
- Background: Light → Highlighted
- Shadow: None → Small shadow
- Lift: 2px
- Duration: 150ms
```

**Loading State**:
```
- Spinner: Rotating circle (1s per rotation)
- Pulse: Content placeholder fading in/out
- Duration: 1500ms
```

### Interactive Elements

**Hover Effects**:
- Buttons: Color change + scale + shadow
- Cards: Lift + shadow increase
- Links: Color change + underline
- Icons: Rotate or color change
- Table rows: Background + shadow

**Focus States** (Keyboard):
- Visible outline (3px)
- Color: Role-based color
- Works on all interactive elements

**Active States**:
- Buttons: Pressed effect (darker, scaled down)
- Tabs: Underline or background
- Menu items: Highlight

---

## 13. CODE ARCHITECTURE

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Common/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── Theme.jsx
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   ├── OTP.jsx
│   │   │   ├── Signup.jsx
│   │   │   └── ForgotPassword.jsx
│   │   ├── Dashboard/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── FacultyDashboard.jsx
│   │   │   └── StudentDashboard.jsx
│   │   ├── Tables/
│   │   │   ├── Table.jsx
│   │   │   ├── TableRow.jsx
│   │   │   └── TableCell.jsx
│   │   ├── Forms/
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── Button.jsx
│   │   │   └── FormGroup.jsx
│   │   ├── Cards/
│   │   │   ├── Card.jsx
│   │   │   ├── StatCard.jsx
│   │   │   └── ClassCard.jsx
│   │   ├── Modals/
│   │   │   ├── Modal.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   └── FormModal.jsx
│   │   ├── Timetable/
│   │   │   ├── TimetableGrid.jsx
│   │   │   ├── TimetableCell.jsx
│   │   │   └── TimetableView.jsx
│   │   ├── Charts/
│   │   │   ├── LineChart.jsx
│   │   │   ├── BarChart.jsx
│   │   │   └── PieChart.jsx
│   │   └── UI/
│   │       ├── Toast.jsx
│   │       ├── Spinner.jsx
│   │       ├── Badge.jsx
│   │       └── Avatar.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── FacultyDashboard.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── MasterData.jsx
│   │   ├── Timetable.jsx
│   │   ├── Reports.jsx
│   │   ├── Profile.jsx
│   │   └── NotFound.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useFetch.js
│   │   ├── useTheme.js
│   │   ├── useForm.js
│   │   └── useNotification.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── ThemeContext.jsx
│   │   ├── NotificationContext.jsx
│   │   └── AppContext.jsx
│   ├── services/
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── dataService.js
│   │   └── timetableService.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── helpers.js
│   │   ├── formatters.js
│   │   └── validators.js
│   ├── styles/
│   │   ├── globals.css
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── animations.css
│   │   └── responsive.css
│   ├── App.jsx
│   └── index.jsx
├── public/
│   ├── index.html
│   └── assets/
├── .env.example
├── package.json
├── tailwind.config.js
└── vite.config.js
```

### Component Pattern

```jsx
// Example component
import React, { useState } from 'react';

const Button = ({ 
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  className = ''
}) => {
  const baseClasses = 'font-semibold rounded transition-all duration-150';
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        ${className}
      `}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
```

### State Management (Context API)

```jsx
// AuthContext
import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email, otp) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/verify-login-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      setUser(data.user);
      setRole(data.role);
      localStorage.setItem('token', data.token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### API Service

```jsx
// services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## 14. IMPLEMENTATION CHECKLIST

### Phase 1: Setup (Week 1)
- [ ] Initialize React project with Vite
- [ ] Install Tailwind CSS, Framer Motion
- [ ] Setup folder structure
- [ ] Create base components (Button, Input, Card)
- [ ] Setup routing with React Router
- [ ] Setup Context API for auth/theme

### Phase 2: Auth Pages (Week 1-2)
- [ ] Login page
- [ ] OTP verification
- [ ] Signup page
- [ ] Forgot password
- [ ] Password reset
- [ ] Profile page

### Phase 3: Admin Dashboard (Week 2-3)
- [ ] Sidebar navigation
- [ ] Summary page with stats
- [ ] Master data CRUD pages (6 modules)
- [ ] Timetable generator
- [ ] Reports section
- [ ] Activity logs

### Phase 4: Faculty Features (Week 3-4)
- [ ] Faculty dashboard
- [ ] Personal timetable
- [ ] Student timetables
- [ ] Student list management
- [ ] Timetable sharing

### Phase 5: Student Features (Week 4)
- [ ] Student dashboard
- [ ] Simple timetable viewer
- [ ] Class details

### Phase 6: Polish & Testing (Week 5)
- [ ] Dark mode support
- [ ] Mobile responsiveness
- [ ] Animation fine-tuning
- [ ] Performance optimization
- [ ] Browser testing
- [ ] Accessibility check

### Code Quality Checklist
- [ ] ESLint configured
- [ ] Prettier formatting
- [ ] Component prop validation
- [ ] Error handling
- [ ] Loading states
- [ ] Empty states
- [ ] 404/Error pages
- [ ] Unit tests (Jest)
- [ ] E2E tests (Cypress optional)

### Performance Checklist
- [ ] Bundle size < 500KB gzipped
- [ ] Page load < 2 seconds
- [ ] Lighthouse score > 90
- [ ] 60fps animations
- [ ] Lazy loading implemented
- [ ] Images optimized

### Accessibility Checklist
- [ ] Keyboard navigation works
- [ ] ARIA labels added
- [ ] Color contrast 4.5:1+
- [ ] Focus indicators visible
- [ ] Form labels associated
- [ ] Screen reader tested

### Mobile Testing
- [ ] iPhone 12 (375px)
- [ ] iPad (768px)
- [ ] Desktop (1440px)
- [ ] Touch interactions work
- [ ] Responsive images

---

## SUMMARY

**What to Build**:
1. **Admin** - Powerful dashboard with full control
2. **Faculty** - Simple, focused timetable + student management
3. **Student** - Minimal, clean class schedule

**Key Principles**:
- ✅ Effective > Beautiful
- ✅ Fast & Responsive
- ✅ Role-specific UIs
- ✅ Modern but professional
- ✅ Same backend, new frontend

**Technology**:
- React + Tailwind CSS
- Framer Motion for animations
- Axios for API calls
- Context API for state
- Vite for fast builds

**Timeline**: 5 weeks (if starting from scratch)

**Success**: Hackathon-ready UI that users love and admins respect ✨

---
