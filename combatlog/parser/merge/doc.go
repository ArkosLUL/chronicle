// Package merge handles taking 2 log files, and merging them together in
// timestamp order. Turtle wow with SuperWoW emits a raw log and a regular log.
// Both are required and include information the other does not have.
//
// Merging the streams into a single ordered stream simplifies the parsing code.
package merge
