package shortcode

import (
	"fmt"
	"testing"
)

func TestR(t *testing.T) {
	x, _ := RandomBase62(8)
	fmt.Println(x)
}
