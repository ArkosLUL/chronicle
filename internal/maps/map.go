package maps

func MapFromSlice[K comparable, F any, T any](s []F, keyFunc func(F) K, convert func(F) T) map[K]T {
	m := make(map[K]T, len(s))
	for _, v := range s {
		m[keyFunc(v)] = convert(v)
	}
	return m
}

func Map[K comparable, F any, T any](m map[K]F, convert func(F) T) map[K]T {
	cpy := make(map[K]T, len(m))
	for k, v := range m {
		cpy[k] = convert(v)
	}
	return cpy
}
