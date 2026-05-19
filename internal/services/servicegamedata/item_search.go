package servicegamedata

import (
	"context"
	"net/http"
	"strconv"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Emyrk/chronicle/database"
	"github.com/Emyrk/chronicle/internal/services/servicedbstore"
)

func badRequest(ctx context.Context, w http.ResponseWriter, msg string) {
	httpapi.Write(ctx, w, http.StatusBadRequest, map[string]string{"error": msg})
}

func (s *Service) handleSearchItems(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	db := servicedbstore.DatabaseStore(s.broker)

	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		badRequest(ctx, w, "Query parameter 'q' must be at least 2 characters.")
		return
	}

	quality := int32(-1)
	if v := r.URL.Query().Get("quality"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			badRequest(ctx, w, "Invalid 'quality' parameter.")
			return
		}
		quality = int32(n)
	}

	slot := int32(-1)
	if v := r.URL.Query().Get("slot"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			badRequest(ctx, w, "Invalid 'slot' parameter.")
			return
		}
		slot = int32(n)
	}

	itemClass := int32(-1)
	if v := r.URL.Query().Get("class"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			badRequest(ctx, w, "Invalid 'class' parameter.")
			return
		}
		itemClass = int32(n)
	}

	// sort param: "quality_desc" (default), "item_level_desc", "item_level_asc",
	// "required_level_desc", "required_level_asc"
	sortParam := r.URL.Query().Get("sort")
	params := database.SearchItemTemplatesParams{
		SearchTerm:    q,
		Quality:       quality,
		InventoryType: slot,
		ItemClass:     itemClass,
	}
	switch sortParam {
	case "item_level_desc":
		params.ItemLevelDesc = true
	case "item_level_asc":
		params.ItemLevelAsc = true
	case "required_level_desc":
		params.RequiredLevelDesc = true
	case "required_level_asc":
		params.RequiredLevelAsc = true
	default:
		params.QualityDesc = true
	}

	rows, err := db.SearchItemTemplates(ctx, params)
	if err != nil {
		httpapi.InternalServerError(w, err)
		return
	}

	results := make([]chroniclesdk.ItemSearchResult, 0, len(rows))
	for _, row := range rows {
		results = append(results, chroniclesdk.ItemSearchResult{
			Entry:             row.Entry,
			Name:              row.Name,
			Quality:           row.Quality,
			InventoryType:     row.InventoryType,
			Class:             row.Class,
			SubClass:          row.Subclass,
			ItemLevel:         row.ItemLevel,
			RequiredLevel:     row.RequiredLevel,
			Delay:             row.Delay,
			DmgMin1:           row.DmgMin1,
			DmgMax1:           row.DmgMax1,
			ContainerSlots:    row.ContainerSlots,
			RequiredSkill:     row.RequiredSkill,
			RequiredSkillRank: row.RequiredSkillRank,
			Armor:             row.Armor,
			Icon:              row.Icon,
		})
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	httpapi.Write(ctx, w, http.StatusOK, results)
}
