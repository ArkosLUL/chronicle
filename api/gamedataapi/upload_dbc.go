package gamedataapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/Emyrk/chronicle/api/chroniclesdk"
	"github.com/Emyrk/chronicle/api/httpapi"
	"github.com/Gophercraft/core/format/dbc"
	"github.com/Gophercraft/core/format/dbc/dbdefs"
	"github.com/Gophercraft/core/vsn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxDBCFileSize = 50 * 1024 * 1024 // 50 MB

// wotlkBuild is the client build number for WoW 3.3.5a (WotLK).
const wotlkBuild vsn.Build = 12340

func (h *Handler) UploadDBC(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "compare"
	}
	if mode != "compare" && mode != "upsert" && mode != "insert" {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Invalid mode, must be 'compare', 'upsert', or 'insert'",
		})
		return
	}

	file, header, err := r.FormFile("dbc_file")
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to get dbc_file from form",
			Detail:  err.Error(),
		})
		return
	}
	defer func() { _ = file.Close() }()

	if header.Size > maxDBCFileSize {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: fmt.Sprintf("File too large (%d bytes), maximum is %d bytes", header.Size, maxDBCFileSize),
		})
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to read uploaded file",
			Detail:  err.Error(),
		})
		return
	}

	// Try to open as ItemDisplayInfo.dbc
	db := dbc.NewDB(wotlkBuild)
	table, err := db.Open("ItemDisplayInfo", bytes.NewReader(data))
	if err != nil {
		httpapi.Write(ctx, w, http.StatusBadRequest, chroniclesdk.Response{
			Message: "Failed to parse DBC file as ItemDisplayInfo",
			Detail:  err.Error(),
		})
		return
	}

	h.handleItemDisplayInfoUpload(ctx, w, mode, table)
}

func (h *Handler) handleItemDisplayInfoUpload(ctx context.Context, w http.ResponseWriter, mode string, table *dbc.Table) {
	var rows []dbdefs.Ent_ItemDisplayInfo
	err := table.Range(func(cursor *dbdefs.Ent_ItemDisplayInfo) bool {
		// Copy the struct so we own the data.
		rows = append(rows, *cursor)
		return true
	})
	if err != nil {
		httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
			Message: "Failed to iterate DBC rows",
			Detail:  err.Error(),
		})
		return
	}

	resp := chroniclesdk.DBCUploadResponse{
		DBCName:     "ItemDisplayInfo",
		RecordCount: len(rows),
		Mode:        mode,
	}

	if mode == "compare" {
		// Just count — no DB writes.
		resp.Inserted = len(rows)
		httpapi.Write(ctx, w, http.StatusOK, resp)
		return
	}

	// Batch upsert into dbc_item_display_info and world_display_info.
	const batchSize = 500

	const idiSQL = `INSERT INTO dbc_item_display_info (
			id, model_name, model_texture, geoset_group, flags, spell_visual_id,
			helmet_geoset_vis, texture, item_visual, particle_color_id,
			attachment_geoset_group, item_ranged_display_info_id,
			model_material_resources_id, model_resources_id, model_type_1,
			override_swoosh_sound_kit_id, sheathe_transform_matrix_id,
			sheathed_spell_visual_kit_id, state_spell_visual_kit_id,
			unsheathed_spell_visual_kit_id, inventory_icon, group_sound_index,
			ground_model, item_size, helmet_geoset_vis_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
		ON CONFLICT (id) DO UPDATE SET
			model_name=EXCLUDED.model_name, model_texture=EXCLUDED.model_texture,
			geoset_group=EXCLUDED.geoset_group, flags=EXCLUDED.flags,
			spell_visual_id=EXCLUDED.spell_visual_id, helmet_geoset_vis=EXCLUDED.helmet_geoset_vis,
			texture=EXCLUDED.texture, item_visual=EXCLUDED.item_visual,
			particle_color_id=EXCLUDED.particle_color_id,
			attachment_geoset_group=EXCLUDED.attachment_geoset_group,
			item_ranged_display_info_id=EXCLUDED.item_ranged_display_info_id,
			model_material_resources_id=EXCLUDED.model_material_resources_id,
			model_resources_id=EXCLUDED.model_resources_id, model_type_1=EXCLUDED.model_type_1,
			override_swoosh_sound_kit_id=EXCLUDED.override_swoosh_sound_kit_id,
			sheathe_transform_matrix_id=EXCLUDED.sheathe_transform_matrix_id,
			sheathed_spell_visual_kit_id=EXCLUDED.sheathed_spell_visual_kit_id,
			state_spell_visual_kit_id=EXCLUDED.state_spell_visual_kit_id,
			unsheathed_spell_visual_kit_id=EXCLUDED.unsheathed_spell_visual_kit_id,
			inventory_icon=EXCLUDED.inventory_icon, group_sound_index=EXCLUDED.group_sound_index,
			ground_model=EXCLUDED.ground_model, item_size=EXCLUDED.item_size,
			helmet_geoset_vis_id=EXCLUDED.helmet_geoset_vis_id`

	const wdiSQL = `INSERT INTO world_display_info (id, icon)
		VALUES ($1, $2)
		ON CONFLICT (id) DO UPDATE SET icon=EXCLUDED.icon`

	batch := &pgx.Batch{}
	for _, row := range rows {
		batch.Queue(idiSQL,
			row.ID,
			jsonSlice(row.ModelName), jsonSlice(row.ModelTexture),
			jsonSlice(row.GeosetGroup), row.Flags, row.SpellVisualID,
			jsonSlice(row.HelmetGeosetVis), jsonSlice(row.Texture),
			row.ItemVisual, row.ParticleColorID,
			jsonSlice(row.AttachmentGeosetGroup), row.ItemRangedDisplayInfoID,
			jsonSlice(row.ModelMaterialResourcesID), jsonSlice(row.ModelResourcesID),
			row.ModelType1, row.OverrideSwooshSoundKitID,
			row.SheatheTransformMatrixID, row.SheathedSpellVisualKitID,
			row.StateSpellVisualKitID, row.UnsheathedSpellVisualKitID,
			jsonSlice(row.InventoryIcon), row.GroupSoundIndex,
			row.GroundModel, row.ItemSize, jsonSlice(row.HelmetGeosetVisID),
		)

		// Also populate world_display_info with the first inventory icon.
		icon := ""
		if len(row.InventoryIcon) > 0 {
			icon = row.InventoryIcon[0]
		}
		batch.Queue(wdiSQL, row.ID, icon)

		if batch.Len() >= batchSize {
			if err := flushBatch(ctx, h.pool, batch); err != nil {
				httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
					Message: "Failed to write batch",
					Detail:  err.Error(),
				})
				return
			}
			batch = &pgx.Batch{}
		}
	}
	if batch.Len() > 0 {
		if err := flushBatch(ctx, h.pool, batch); err != nil {
			httpapi.Write(ctx, w, http.StatusInternalServerError, chroniclesdk.Response{
				Message: "Failed to write final batch",
				Detail:  err.Error(),
			})
			return
		}
	}

	resp.Inserted = len(rows) // Simplified — upsert doesn't distinguish insert vs update here.
	httpapi.Write(ctx, w, http.StatusOK, resp)
}

func flushBatch(ctx context.Context, pool *pgxpool.Pool, batch *pgx.Batch) error {
	br := pool.SendBatch(ctx, batch)
	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			_ = br.Close()
			return err
		}
	}
	return br.Close()
}

// jsonSlice marshals any slice to JSON for JSONB columns.
func jsonSlice(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("[]")
	}
	return b
}
