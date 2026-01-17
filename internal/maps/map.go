package maps

func Map[K comparable, F any, T any](m map[K]F, convert func(F) T) map[K]T {
	cpy := make(map[K]T, len(m))
	for k, v := range m {
		cpy[k] = convert(v)
	}
	return cpy
}
