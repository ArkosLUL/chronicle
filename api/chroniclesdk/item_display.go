package chroniclesdk

// ItemDisplayData contains the data needed to render a 3D model of an item.
// It combines item identity from world_item_template with model/texture
// references from ItemDisplayInfo.dbc.
type ItemDisplayData struct {
	Entry         int32 `json:"entry"`
	Name          string `json:"name"`
	Quality       int32 `json:"quality"`
	ItemClass     int32 `json:"item_class"`
	ItemSubclass  int32 `json:"item_subclass"`
	InventoryType int32 `json:"inventory_type"`
	Sheath        int32 `json:"sheath"`
	DisplayID     int32 `json:"display_id"`

	// From ItemDisplayInfo DBC
	ModelName       []string `json:"model_name"`        // M2 model files (typically 2: left/right hand)
	ModelTexture    []string `json:"model_texture"`      // Texture files for models (typically 2)
	GeosetGroup     []int32  `json:"geoset_group"`       // Geoset group indices (typically 3)
	Texture         []string `json:"texture"`            // Body region textures (8: arm_upper, arm_lower, hand, torso_upper, torso_lower, leg_upper, leg_lower, foot)
	InventoryIcon   []string `json:"inventory_icon"`     // Icon filenames (2: normal, grey)
	HelmetGeosetVis []int32  `json:"helmet_geoset_vis"`  // Helmet visibility flags (typically 2)
	GeosetVisID     []int32  `json:"geoset_vis_id"`      // Helmet geoset vis IDs (typically 2)
	GroundModel     string   `json:"ground_model"`       // Ground/dropped model path
	ItemVisual      int32    `json:"item_visual"`        // Visual effect ID
	Flags           int32    `json:"flags"`              // Display flags
}
