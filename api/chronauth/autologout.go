package chronauth

import "net/http"

func AutoLogout(next http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    http.SetCookie(w, &http.Cookie{Name: "token", MaxAge: -1})
  })

}
