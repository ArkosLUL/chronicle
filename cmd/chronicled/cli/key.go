package cli

import (
	"encoding/base64"
	"fmt"

	"github.com/Emyrk/chronicle/api/chronauth/authkeys"

	"github.com/coder/serpent"
)

func GenerateSecretKey() *serpent.Command {
	cmd := &serpent.Command{
		Use:    "secret",
		Hidden: true,
		Handler: func(i *serpent.Invocation) error {
			sec, err := authkeys.GenerateKey()
			if err != nil {
				return err
			}

			output := authkeys.MarshalPrivateKey(sec)

			_, _ = fmt.Fprintf(i.Stdout, "Generated Secret Key:\n%s\n", base64.StdEncoding.EncodeToString(output))
			return nil
		},
	}

	return cmd
}
