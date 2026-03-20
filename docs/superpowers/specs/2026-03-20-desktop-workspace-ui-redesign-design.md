# Desktop Workspace UI Redesign Design

## Overview

This document defines a focused UI and interaction redesign for the `SRT Translate` desktop experience.

The target is a modern product-style workspace that feels like a polished productivity tool rather than a developer-facing utility panel. The redesign should improve scanability, hierarchy, and action clarity while preserving the existing translation workflow and state model.

## Goals

- Reframe the application as a modern desktop workspace for subtitle translation.
- Improve visual hierarchy so upload, configuration, progress, and results are clearly separated.
- Increase desktop productivity through clearer grouping, denser but readable information layout, and faster action discovery.
- Preserve the current end-to-end workflow and translation behavior.
- Keep implementation scoped to frontend UI and interaction presentation.

## Non-Goals

- No changes to provider request logic or server APIs.
- No new translation features, persistence, history, or collaboration.
- No dedicated mobile-first redesign in this iteration.
- No heavy editor-style inline subtitle editing workflow.

## Current Problems

The current UI is functional but has several weaknesses for prolonged desktop use:

- The sidebar and main panel use similar card treatment, so primary and secondary areas compete visually.
- The upload screen feels like a utility dropzone instead of a product workspace entry point.
- Status and workflow progression are present, but not surfaced as a strong narrative.
- The result area lacks a strong summary layer, making the list feel heavy for large subtitle files.
- Subtitle cards expose raw state but do not present success, retry, and failure states with enough clarity.

## Design Direction

The redesign should follow a modern product workspace aesthetic:

- Light, high-clarity desktop canvas rather than dark glassmorphism.
- Calm teal-led palette for product identity and trust.
- Warm orange accent only for primary action emphasis.
- Clear structural rhythm with large outer layout blocks and tighter inner control groupings.
- Strong summary layer above detailed content.

## Design System

### Visual Language

- Product pattern: desktop interactive workspace
- Tone: modern, efficient, polished, self-hosted professional tool
- Motion: subtle hover and state transitions only
- Density: optimized for 1280px+ desktop use

### Color

- Primary: teal family for selection, active states, and progress emphasis
- Accent: orange for major CTA and completion/download emphasis
- Surface: warm off-white backgrounds with white elevated cards
- Text: dark slate/green-tinted neutrals for high contrast
- Status:
  - success uses green-teal tint
  - error uses soft red tint
  - retrying uses amber tint
  - pending uses neutral gray tint

### Typography

- Headline/body direction: `Plus Jakarta Sans`-style modern SaaS typography
- Larger, bolder page and section headings
- Compact support text for provider notes, metadata, and logs

## Information Architecture

The page should be restructured into three persistent zones:

1. Top workspace header
2. Left control rail
3. Right main content area

### Workspace Header

The top header should establish context immediately:

- product title
- current file name
- workflow stage label
- high-signal metrics such as total entries, completed entries, and failures
- quick summary copy for the current mode

This layer should reduce the need to read the sidebar before understanding the current state.

### Left Control Rail

The left rail should remain the operational control center, but be visually cleaner:

- file summary card
- provider selection section with stronger active-state clarity
- provider-specific fields grouped as a configuration form
- translation tuning controls grouped separately
- action area with a single dominant primary action
- compact activity log area

The rail should feel like a control console rather than a stack of unrelated cards.

### Right Main Area

The right area should become a content workspace:

- results header with title and subtitle
- summary strip with aggregate counts
- filter controls and result actions
- error banner when relevant
- scrollable subtitle list

## Upload Experience

The upload screen should feel like a product landing entry to the workspace rather than a blank drop target.

### Expected Elements

- stronger heading and supporting product promise
- prominent dropzone with clear drag state
- supporting helper points explaining what the tool supports
- visible error feedback directly below the card

## Interaction Design

### Workflow Cues

- current stage should be explicitly labeled in the header
- translation-in-progress state should visibly affect controls and summaries
- retry state should remain distinct from full translation state

### Action Hierarchy

- only one primary button per major area
- secondary and ghost actions should be visibly subordinate
- destructive or reset-like actions should stay visually de-emphasized

### Feedback Rules

- operations with waiting time must show live status context
- filters should reflect active state clearly
- retry controls should be easy to locate on both bulk and per-item paths

## Subtitle List Design

Subtitle entries should remain card-based, but with clearer structure:

- metadata row with index, timecode, and translated human-readable status
- two-column comparison layout for source and translation
- stronger empty/default copy for untranslated and failed states
- dedicated inline retry action for failed entries

The list should favor quick scanning over decorative styling.

## Accessibility And Usability

- keep semantic labels on form controls
- preserve keyboard accessibility for buttons and filters
- ensure visible focus states on interactive controls
- maintain high contrast in light mode
- keep motion subtle and non-essential

## Implementation Scope

Implementation should focus on:

- `src/styles/globals.css`
- `src/features/subtitle-translator/SubtitleTranslatorPage.tsx`
- `src/features/subtitle-translator/components/UploadScreen.tsx`
- `src/features/subtitle-translator/components/ProviderPanel.tsx`
- `src/features/subtitle-translator/components/TranslationPanel.tsx`
- `src/features/subtitle-translator/components/ResultToolbar.tsx`
- `src/features/subtitle-translator/components/SubtitleList.tsx`
- `src/features/subtitle-translator/SubtitleTranslatorPage.test.tsx`

No data-flow redesign is required. Existing hooks, reducer logic, and provider plumbing should remain intact.

## Acceptance Criteria

The redesign is complete when:

- the upload screen feels like a product entry screen, not a bare utility form
- the main page has a clear desktop workspace hierarchy with header, control rail, and content area
- primary, secondary, and status actions are visually differentiated
- subtitle status becomes easier to scan in the list
- translation progress and summary metrics are surfaced prominently
- existing workflow tests still pass, with added coverage for the new UI structure
- `npm test` and `npm run build` pass
