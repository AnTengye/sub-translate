package static

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type SPAHandler struct {
	DistDir string
}

func (h SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestPath := strings.TrimPrefix(r.URL.Path, "/")
	if requestPath != "" {
		targetPath := filepath.Join(h.DistDir, filepath.Clean(requestPath))
		if info, err := os.Stat(targetPath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, targetPath)
			return
		}
	}

	http.ServeFile(w, r, filepath.Join(h.DistDir, "index.html"))
}
