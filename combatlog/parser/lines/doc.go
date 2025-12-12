// Package lines is a utility package that handles parsing lines emitted from the
// combat log. All logs have the same basic format of a timestamp followed by
// content.
//
// This package also handles guessing the year the log refers to, as year data is not included in the log lines.
// It does this by choosing the most logical year based on the current date. This normalizes the timestamps
// for database use and easier handling by the `time` package.
package lines
