//go:build !turtle && !epoch && !kronos

package services

// ServerName identifies the WoW server this binary was built for.
// Default to turtle when no server build tag is specified.
const ServerName = "turtle"
const ServerBuild = vsn.V1_12_2