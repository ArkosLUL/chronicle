package main

import (
	"context"
	"log"
)

func main() {
	err := RunExample(context.Background())
	if err != nil {
		log.Fatal(err.Error())
	}
}
