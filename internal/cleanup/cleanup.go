package cleanup

type Cleanup struct {
	Dos []func()
}

func New(dos ...func()) *Cleanup {
	return &Cleanup{
		Dos: dos,
	}
}

func (c *Cleanup) Add(f ...func()) *Cleanup {
	c.Dos = append(c.Dos, f...)
	return c
}

func (c *Cleanup) Do() {
	for _, f := range c.Dos {
		f()
	}
}

func (c *Cleanup) Clear() {
	c.Dos = nil
}
