package logfile

import "io"

type Context struct {
	IsRaw *bool
}

type Reader interface {
	io.Reader
	Context() *Context
	Raw() *bool
}

type Log struct {
	raw *bool
	io.Reader
}

func New(raw *bool, rdr io.Reader) *Log {
	return &Log{
		raw:    raw,
		Reader: rdr,
	}
}

func (f *Log) Context() *Context {
	return &Context{
		IsRaw: f.raw,
	}
}

func (f *Log) Raw() *bool {
	return f.raw
}

func (f *Log) SetIsRaw(raw bool) {
	f.raw = &raw
}
