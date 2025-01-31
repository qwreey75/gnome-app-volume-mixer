<!-- markdownlint-disable-file MD025, MD024 -->
# 2.1-pre3
<!-- @BuildNumber: 3 -->
<!-- @Includes: [] -->
<!-- @Date: "2025-1-31 20:39:00 KST" -->

- Update repo url in metadata
- Option to hide dnd indicator completely
- Debugging
  - Use better logging format
  - Add logging level option
  - Add extension environment expose option
- Notifications widget
  - Add vfade offset option
  - Add scrollbar visibility option 

## Fix

- Fix 'PageIndicators has been already disposed' issue
- Add more promise catch handlers and source naming for debugging
- Removed fixStScrollViewScrollbarOverflow, use vscrollbar_policy instead

## Known issues

- Cannot hide keyboard quick toggle

# 2.1-pre2
<!-- @BuildNumber: 2 -->
<!-- @Includes: [] -->
<!-- @Date: "2025-1-23 00:40:00 KST" -->

## New Features

- Add quick toggle ordering and hiding
- Add page indicator on media widget
- Add DND indicator position option
- Add save last session state option on unsafe mode quick toggle

## Fix

- Fix changelog text align
- Fix pref page scroll flickering issue
- Fix weather widget empty when no location selected issue

## Prefs QOL patch

- Move contributor rows to dialog

# 2.1-pre1
<!-- @BuildNumber: 1 -->
<!-- @Includes: [] -->
<!-- @Date: "2025-1-22 13:16:00 KST" -->

- Using major.middle.minor version system
- Using girs and typescript, for better development
- New stable, github-stable, github-preview release channel

## Shell version bump

shell-version >= 45, >= 48

## Prefs QOL patch

- Some space rich option groups are now using bottom sheet layout
- Add button for reset modified options
- Organize about section
  - Add changelogs subpage

## New Features

- Reorder and hide system items
- Reanimate menu, overlay menu mode
- Weather widget

## Known issues

- Sometime, the media progress bar displayed even should't be displayed
- Weather widget shows empty box when region wasn't selected
