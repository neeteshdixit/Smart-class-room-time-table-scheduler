# 🎨 DESIGN TOKENS & IMPLEMENTATION SPECIFICATIONS
## Smart Classroom Timetable Scheduler - Frontend Redesign

**Version**: 1.0  
**For Use With**: Stitch, Figma, Copilot, or Similar AI UI Generators

---

## 1. DESIGN TOKENS

### 1.1 Color Tokens

#### Semantic Colors

```css
/* PRIMARY COLORS */
--color-primary: #0066FF;          /* Main brand blue */
--color-primary-dark: #0052CC;      /* Dark blue for hover */
--color-primary-light: #E6F2FF;     /* Light blue bg */

/* SECONDARY COLORS */
--color-secondary: #FF8C42;         /* Orange accent */
--color-accent: #8B5CF6;            /* Purple accent */

/* SEMANTIC COLORS */
--color-success: #10B981;           /* Green for success */
--color-error: #EF4444;             /* Red for errors */
--color-warning: #F59E0B;           /* Orange for warnings */
--color-info: #06B6D4;              /* Cyan for info */

/* NEUTRAL COLORS - LIGHT MODE */
--color-bg-primary: #F9FAFB;        /* Page background */
--color-bg-secondary: #FFFFFF;      /* Card background */
--color-bg-tertiary: #F3F4F6;       /* Subtle background */
--color-border: #E5E7EB;            /* Border color */
--color-text-primary: #1F2937;      /* Main text */
--color-text-secondary: #6B7280;    /* Secondary text */
--color-text-tertiary: #9CA3AF;     /* Disabled text */
--color-shadow: rgba(0, 0, 0, 0.1); /* Shadow base */

/* NEUTRAL COLORS - DARK MODE */
--color-dark-bg-primary: #0F172A;
--color-dark-bg-secondary: #1E293B;
--color-dark-bg-tertiary: #334155;
--color-dark-border: #475569;
--color-dark-text-primary: #F1F5F9;
--color-dark-text-secondary: #CBD5E1;
--color-dark-text-tertiary: #64748B;
--color-dark-shadow: rgba(0, 0, 0, 0.3);
```

#### Subject-Specific Colors (for timetable cells)

```css
--subject-color-1: #FF6B6B;  /* Computer Science - Red */
--subject-color-2: #4ECDC4;  /* Mathematics - Teal */
--subject-color-3: #45B7D1;  /* Physics - Blue */
--subject-color-4: #FFA07A;  /* Chemistry - Salmon */
--subject-color-5: #98D8C8;  /* Biology - Mint */
--subject-color-6: #F7DC6F;  /* English - Yellow */
--subject-color-7: #BB8FCE;  /* History - Purple */
--subject-color-8: #85C1E2;  /* Geography - Sky Blue */
```

### 1.2 Typography Tokens

```css
/* FONT FAMILIES */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
--font-heading: 'Poppins', 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* FONT SIZES */
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;   /* 36px */
--font-size-5xl: 3rem;      /* 48px */

/* FONT WEIGHTS */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;

/* LINE HEIGHTS */
--line-height-tight: 1.2;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
--line-height-loose: 2;
```

### 1.3 Spacing Tokens

```css
--spacing-0: 0;
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
--spacing-20: 5rem;     /* 80px */

/* COMMON PADDING VALUES */
--padding-button: var(--spacing-2) var(--spacing-4);
--padding-card: var(--spacing-6);
--padding-input: var(--spacing-2) var(--spacing-3);
--padding-page: var(--spacing-8);

/* COMMON GAPS */
--gap-xs: var(--spacing-2);
--gap-sm: var(--spacing-3);
--gap-md: var(--spacing-4);
--gap-lg: var(--spacing-6);
--gap-xl: var(--spacing-8);
```

### 1.4 Border Radius Tokens

```css
--radius-none: 0;
--radius-sm: 0.375rem;   /* 6px */
--radius-base: 0.5rem;   /* 8px */
--radius-md: 0.75rem;    /* 12px */
--radius-lg: 1rem;       /* 16px */
--radius-full: 9999px;   /* Fully rounded */

/* COMMON USAGE */
--radius-button: var(--radius-base);
--radius-input: var(--radius-base);
--radius-card: var(--radius-md);
--radius-modal: var(--radius-lg);
```

### 1.5 Shadow Tokens

```css
/* ELEVATION SHADOWS */
--shadow-none: none;
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

/* ELEVATED SHADOWS (Cards on hover) */
--shadow-elevation-1: 0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-elevation-2: 0 4px 16px rgba(0, 0, 0, 0.12);
--shadow-elevation-3: 0 8px 24px rgba(0, 0, 0, 0.15);
```

### 1.6 Transition Tokens

```css
/* DURATIONS */
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

/* EASING FUNCTIONS */
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out-cubic: cubic-bezier(0.33, 0.66, 0.66, 1);
--ease-out-back: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* COMMON TRANSITIONS */
--transition-fast: all var(--duration-fast) var(--ease-out);
--transition-base: all var(--duration-base) var(--ease-out);
--transition-slow: all var(--duration-slow) var(--ease-out);
--transition-colors: color, background-color, border-color var(--duration-base) var(--ease-out);
--transition-transform: transform var(--duration-base) var(--ease-out);
```

---

## 2. COMPONENT SPECIFICATIONS

### 2.1 Button Component

#### States & Variations

```jsx
/* BUTTON VARIANTS */

/* PRIMARY BUTTON */
{
  "variant": "primary",
  "padding": "8px 16px",
  "height": "40px",
  "borderRadius": "8px",
  "fontSize": "14px",
  "fontWeight": "600",
  "backgroundColor": "#0066FF",
  "color": "#FFFFFF",
  "border": "none",
  "cursor": "pointer",
  "transitions": ["backgroundColor", "transform", "box-shadow"],
  "states": {
    "default": {
      "backgroundColor": "#0066FF",
      "boxShadow": "0 1px 3px rgba(0, 0, 0, 0.1)"
    },
    "hover": {
      "backgroundColor": "#0052CC",
      "transform": "scale(1.05)",
      "boxShadow": "0 4px 12px rgba(0, 102, 255, 0.3)"
    },
    "active": {
      "backgroundColor": "#003D99",
      "transform": "scale(0.95)"
    },
    "disabled": {
      "backgroundColor": "#CCCCCC",
      "opacity": "0.5",
      "cursor": "not-allowed"
    },
    "loading": {
      "opacity": "0.7",
      "cursor": "not-allowed"
    }
  }
}

/* SECONDARY BUTTON */
{
  "variant": "secondary",
  "padding": "8px 16px",
  "height": "40px",
  "borderRadius": "8px",
  "fontSize": "14px",
  "fontWeight": "600",
  "backgroundColor": "transparent",
  "color": "#0066FF",
  "border": "1px solid #0066FF",
  "states": {
    "default": {
      "backgroundColor": "transparent",
      "borderColor": "#0066FF"
    },
    "hover": {
      "backgroundColor": "#F0F7FF",
      "borderColor": "#0052CC",
      "color": "#0052CC"
    }
  }
}

/* BUTTON SIZES */
{
  "sizes": {
    "xs": { "padding": "4px 8px", "height": "28px", "fontSize": "12px" },
    "sm": { "padding": "6px 12px", "height": "32px", "fontSize": "13px" },
    "md": { "padding": "8px 16px", "height": "40px", "fontSize": "14px" },
    "lg": { "padding": "10px 20px", "height": "48px", "fontSize": "15px" },
    "xl": { "padding": "12px 24px", "height": "56px", "fontSize": "16px" }
  }
}
```

### 2.2 Input Component

```jsx
/* INPUT FIELD SPECIFICATIONS */
{
  "component": "Input",
  "height": "40px",
  "padding": "8px 12px",
  "fontSize": "14px",
  "fontFamily": "'Inter', sans-serif",
  "borderRadius": "8px",
  "border": "1px solid #E5E7EB",
  "states": {
    "default": {
      "backgroundColor": "#FFFFFF",
      "borderColor": "#E5E7EB",
      "color": "#1F2937"
    },
    "focus": {
      "borderColor": "#0066FF",
      "boxShadow": "0 0 0 3px rgba(0, 102, 255, 0.1)",
      "outline": "none"
    },
    "hover": {
      "borderColor": "#D1D5DB"
    },
    "disabled": {
      "backgroundColor": "#F3F4F6",
      "color": "#9CA3AF",
      "cursor": "not-allowed",
      "opacity": "0.5"
    },
    "error": {
      "borderColor": "#EF4444",
      "boxShadow": "0 0 0 3px rgba(239, 68, 68, 0.1)"
    },
    "success": {
      "borderColor": "#10B981",
      "boxShadow": "0 0 0 3px rgba(16, 185, 129, 0.1)"
    }
  },
  "placeholder": {
    "color": "#9CA3AF"
  },
  "label": {
    "display": "block",
    "marginBottom": "6px",
    "fontSize": "14px",
    "fontWeight": "500",
    "color": "#1F2937"
  },
  "helpText": {
    "fontSize": "12px",
    "color": "#6B7280",
    "marginTop": "4px"
  },
  "errorText": {
    "fontSize": "12px",
    "color": "#EF4444",
    "marginTop": "4px",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px"
  }
}
```

### 2.3 Card Component

```jsx
/* CARD SPECIFICATIONS */
{
  "component": "Card",
  "padding": "20px 24px",
  "borderRadius": "12px",
  "backgroundColor": "#FFFFFF",
  "border": "1px solid #E5E7EB",
  "boxShadow": "0 1px 3px rgba(0, 0, 0, 0.1)",
  "states": {
    "default": {
      "boxShadow": "0 1px 3px rgba(0, 0, 0, 0.1)"
    },
    "hover": {
      "boxShadow": "0 10px 25px rgba(0, 0, 0, 0.1)",
      "transform": "translateY(-2px)"
    }
  },
  "darkMode": {
    "backgroundColor": "#1E293B",
    "borderColor": "#334155",
    "boxShadow": "0 1px 3px rgba(0, 0, 0, 0.3)"
  },
  "variants": {
    "elevated": {
      "boxShadow": "0 4px 12px rgba(0, 0, 0, 0.15)"
    },
    "flat": {
      "border": "none",
      "boxShadow": "none"
    }
  }
}
```

### 2.4 Modal Component

```jsx
/* MODAL SPECIFICATIONS */
{
  "component": "Modal",
  "position": "fixed",
  "inset": "0",
  "display": "flex",
  "alignItems": "center",
  "justifyContent": "center",
  "zIndex": "1050",
  "backdrop": {
    "backgroundColor": "rgba(0, 0, 0, 0.5)",
    "animation": "fadeIn 300ms ease-out"
  },
  "modal": {
    "backgroundColor": "#FFFFFF",
    "borderRadius": "12px",
    "boxShadow": "0 20px 25px rgba(0, 0, 0, 0.15)",
    "maxWidth": "500px",
    "maxHeight": "90vh",
    "width": "100%",
    "animation": "slideUp 300ms ease-out",
    "sections": {
      "header": {
        "padding": "24px",
        "borderBottom": "1px solid #E5E7EB",
        "display": "flex",
        "justifyContent": "space-between",
        "alignItems": "center"
      },
      "body": {
        "padding": "24px",
        "maxHeight": "calc(90vh - 120px)",
        "overflowY": "auto"
      },
      "footer": {
        "padding": "16px 24px",
        "borderTop": "1px solid #E5E7EB",
        "display": "flex",
        "justifyContent": "flex-end",
        "gap": "12px"
      }
    }
  }
}
```

### 2.5 Table Component

```jsx
/* TABLE SPECIFICATIONS */
{
  "component": "Table",
  "width": "100%",
  "borderCollapse": "collapse",
  "head": {
    "backgroundColor": "#F9FAFB",
    "borderBottom": "2px solid #E5E7EB",
    "th": {
      "padding": "12px 16px",
      "textAlign": "left",
      "fontSize": "12px",
      "fontWeight": "600",
      "color": "#1F2937",
      "textTransform": "uppercase",
      "letterSpacing": "0.05em"
    }
  },
  "body": {
    "tr": {
      "borderBottom": "1px solid #E5E7EB",
      "states": {
        "hover": {
          "backgroundColor": "#F3F4F6"
        },
        "selected": {
          "backgroundColor": "#E6F2FF"
        }
      }
    },
    "td": {
      "padding": "12px 16px",
      "fontSize": "14px",
      "color": "#1F2937"
    }
  },
  "alternateRows": {
    "backgroundColor": "#FAFBFC"
  }
}
```

---

## 3. ANIMATION DEFINITIONS

### 3.1 Page Transitions

```css
/* FADE IN */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* SLIDE UP */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* SLIDE DOWN */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* SCALE IN */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* STAGGER CHILDREN */
@keyframes staggerIn {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3.2 Interactive Animations

```css
/* BUTTON HOVER */
@keyframes buttonHover {
  0% {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);
    transform: scale(1.05);
  }
}

/* LOADING SPINNER */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* PULSE */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* SHAKE (for errors) */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

/* GLOW */
@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(0, 102, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(0, 102, 255, 0.8);
  }
}
```

### 3.3 Framer Motion Presets

```jsx
/* For use with Framer Motion library */

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  out: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const cardHoverVariants = {
  hover: {
    scale: 1.02,
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
    transition: { duration: 0.2 },
  },
};

const buttonTapVariants = {
  tap: { scale: 0.95 },
};
```

---

## 4. RESPONSIVE BREAKPOINTS

### 4.1 Breakpoint Definitions

```css
/* Mobile First Approach */
--breakpoint-xs: 320px;   /* Extra small devices */
--breakpoint-sm: 640px;   /* Small devices */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Large screens */
--breakpoint-2xl: 1536px; /* Extra large screens */
```

### 4.2 Media Query Examples

```css
/* Mobile (320px - 639px) */
@media (max-width: 639px) {
  .container { padding: 16px; }
  .grid { grid-template-columns: 1fr; }
  .sidebar { display: none; }
}

/* Tablet (640px - 1023px) */
@media (min-width: 640px) and (max-width: 1023px) {
  .container { padding: 20px; }
  .grid { grid-template-columns: repeat(2, 1fr); }
  .sidebar { display: block; width: 200px; }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container { padding: 24px; max-width: 1400px; }
  .grid { grid-template-columns: repeat(3, 1fr); }
  .sidebar { width: 280px; }
}
```

---

## 5. ACCESSIBILITY SPECIFICATIONS

### 5.1 WCAG 2.1 AA Compliance Checklist

- [ ] Color contrast ratio minimum 4.5:1 for normal text
- [ ] Color contrast ratio minimum 3:1 for large text (18pt+)
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators clearly visible (min 3px)
- [ ] ARIA labels for icon-only buttons
- [ ] Form labels associated with inputs
- [ ] Error messages linked to form fields
- [ ] Screen reader announcements for status changes
- [ ] Logical heading hierarchy (H1-H6)
- [ ] Alternative text for all images
- [ ] Captions for videos
- [ ] Keyboard shortcuts documented

### 5.2 ARIA Implementation Examples

```jsx
/* BUTTON WITH ICON ONLY */
<button 
  aria-label="Close dialog"
  onClick={onClose}
>
  <CloseIcon />
</button>

/* FORM ERROR */
<input 
  id="email"
  aria-describedby="email-error"
  aria-invalid={hasError}
/>
<span id="email-error" role="alert">
  {errorMessage}
</span>

/* LIVE REGION FOR NOTIFICATIONS */
<div 
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>
```

---

## 6. PERFORMANCE SPECIFICATIONS

### 6.1 Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | > 90 |
| Accessibility | > 85 |
| Best Practices | > 90 |
| SEO | > 90 |

### 6.2 Core Web Vitals

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |

### 6.3 Performance Optimization Checklist

- [ ] Code splitting implemented for routes
- [ ] Lazy loading for images
- [ ] Minification of CSS/JS
- [ ] Gzip compression enabled
- [ ] Browser caching configured
- [ ] CDN for static assets
- [ ] Optimize bundle size < 500KB
- [ ] Tree shaking enabled
- [ ] Critical CSS inline
- [ ] Service Worker for offline support

---

## 7. IMPLEMENTATION GUIDE FOR AI TOOLS

### 7.1 Instructions for Stitch/Similar Tools

1. **Import Design Tokens**: Use the color, typography, spacing tokens provided above
2. **Apply Component Specs**: Follow component specifications for buttons, inputs, cards
3. **Use Animation Definitions**: Reference animations for page transitions and interactions
4. **Implement Responsive**: Use breakpoints defined for mobile-first design
5. **Ensure Accessibility**: Follow WCAG AA compliance checklist
6. **Test Performance**: Verify Lighthouse scores meet targets

### 7.2 Tailwind CSS Configuration

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#0066FF',
        secondary: '#FF8C42',
        accent: '#8B5CF6',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#06B6D4',
      },
      fontFamily: {
        primary: "'Inter', sans-serif",
        heading: "'Poppins', sans-serif",
        mono: "'JetBrains Mono', monospace",
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
      },
      borderRadius: {
        sm: '0.375rem',
        base: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideUp: 'slideUp 0.3s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        spin: 'spin 1s linear infinite',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
    },
  },
}
```

### 7.3 Component Implementation Example

```jsx
// Example: Button component in React
import React from 'react';
import './Button.css';

const Button = ({
  variant = 'primary',
  size = 'md',
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
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⏳</span>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
```

---

## 8. VISUAL REFERENCE GUIDE

### 8.1 Color Swatches

| Category | Color | Hex | Usage |
|----------|-------|-----|-------|
| Primary | Blue | #0066FF | Main brand, CTAs |
| Secondary | Orange | #FF8C42 | Warnings, highlights |
| Accent | Purple | #8B5CF6 | Secondary accent |
| Success | Green | #10B981 | Success messages |
| Error | Red | #EF4444 | Errors, destructive |
| Warning | Yellow | #F59E0B | Warnings, pending |
| Info | Cyan | #06B6D4 | Information |
| Background | Light Gray | #F9FAFB | Page background |
| Surface | White | #FFFFFF | Card background |

### 8.2 Typography Samples

**Display (Hero Text)**
- Font: Poppins Bold (700)
- Size: 48px
- Line Height: 1.2
- Color: #1F2937

**Heading 1**
- Font: Poppins SemiBold (600)
- Size: 36px
- Line Height: 1.3
- Color: #1F2937

**Body Text**
- Font: Inter Regular (400)
- Size: 16px
- Line Height: 1.6
- Color: #1F2937

---

**Document Version**: 1.0  
**Status**: READY FOR IMPLEMENTATION  
**Last Updated**: 2025-05-04

---
