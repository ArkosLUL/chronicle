package jsontransform

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

// TypeTransformer transforms a value into a simplified representation for storage.
// Returns (replacement, true) if handled, or (nil, false) to continue normal processing.
type TypeTransformer func(v any) (replacement any, handled bool)

var transformers []TypeTransformer

// RegisterTransformer adds a type transformer to the registry.
// Transformers are checked in registration order.
func RegisterTransformer(t TypeTransformer) {
	transformers = append(transformers, t)
}

// MarshalForStorage transforms a value using registered transformers and marshals to JSON.
// Types with registered transformers will be replaced with their simplified form.
func MarshalForStorage(v any) ([]byte, error) {
	transformed := Transform(v)
	return json.Marshal(transformed)
}

// Transform walks a value and applies registered type transformers.
func Transform(v any) any {
	return transformValue(reflect.ValueOf(v))
}

func transformValue(v reflect.Value) any {
	if !v.IsValid() {
		return nil
	}

	// Handle interfaces - get the underlying value
	if v.Kind() == reflect.Interface {
		if v.IsNil() {
			return nil
		}
		return transformValue(v.Elem())
	}

	// Handle pointers
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return nil
		}
		// Check transformers on pointer type first
		if v.CanInterface() {
			for _, t := range transformers {
				if replacement, ok := t(v.Interface()); ok {
					return replacement
				}
			}
		}
		return transformValue(v.Elem())
	}

	// Check transformers on value type
	if v.CanInterface() {
		for _, t := range transformers {
			if replacement, ok := t(v.Interface()); ok {
				return replacement
			}
		}
	}

	switch v.Kind() {
	case reflect.Struct:
		return transformStruct(v)
	case reflect.Slice:
		if v.IsNil() {
			return nil
		}
		return transformSlice(v)
	case reflect.Array:
		return transformSlice(v)
	case reflect.Map:
		if v.IsNil() {
			return nil
		}
		return transformMap(v)
	default:
		if v.CanInterface() {
			return v.Interface()
		}
		return nil
	}
}

func transformStruct(v reflect.Value) any {
	result := make(map[string]any)
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		if !field.IsExported() {
			continue
		}

		jsonTag := field.Tag.Get("json")
		if jsonTag == "-" {
			continue
		}

		name, opts := parseJSONTag(jsonTag)
		if name == "" {
			name = field.Name
		}

		fieldVal := v.Field(i)
		transformed := transformValue(fieldVal)

		// Handle omitempty
		if opts.omitempty && isEmpty(transformed) {
			continue
		}

		result[name] = transformed
	}

	return result
}

func transformSlice(v reflect.Value) any {
	result := make([]any, v.Len())
	for i := 0; i < v.Len(); i++ {
		result[i] = transformValue(v.Index(i))
	}
	return result
}

func transformMap(v reflect.Value) any {
	result := make(map[string]any)
	for _, key := range v.MapKeys() {
		keyStr := fmt.Sprint(key.Interface())
		result[keyStr] = transformValue(v.MapIndex(key))
	}
	return result
}

type tagOpts struct {
	omitempty bool
}

func parseJSONTag(tag string) (name string, opts tagOpts) {
	parts := strings.Split(tag, ",")
	if len(parts) > 0 {
		name = parts[0]
	}
	for _, part := range parts[1:] {
		if part == "omitempty" {
			opts.omitempty = true
		}
	}
	return
}

func isEmpty(v any) bool {
	if v == nil {
		return true
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Slice, reflect.Map:
		return rv.Len() == 0
	case reflect.String:
		return rv.Len() == 0
	case reflect.Bool:
		return !rv.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return rv.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return rv.Float() == 0
	case reflect.Interface, reflect.Ptr:
		return rv.IsNil()
	}
	return false
}
