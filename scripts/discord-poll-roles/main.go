package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/bwmarrin/discordgo"
)

const (
	channelID = "1467894476448989247" // Channel containing the poll
	messageID = "1495589095911456978" // Poll message ID
	guildID   = "1466099237669306380" // Chronicle Discord guild
)

// answerToRole maps poll answer_id (1-based) → Discord role ID.
// Fill these in after running with --inspect to see the answer IDs and text.
var answerToRole = map[int]string{
	1: "1496275805851095234", // Kronos
	2: "1496275679476711465", // epoch
	3: "1496275872691388638", // Bronzebeard
	4: "1496275762871931001", // warmane
	// Add more as needed
}

type pollVotersResponse struct {
	Users []struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	} `json:"users"`
}

func getPollVoters(s *discordgo.Session, channelID, messageID string, answerID int) ([]string, error) {
	var allUsers []string
	after := ""

	for {
		url := fmt.Sprintf("%s/channels/%s/polls/%s/answers/%d?limit=100",
			discordgo.EndpointAPI, channelID, messageID, answerID)
		if after != "" {
			url += "&after=" + after
		}

		body, err := s.RequestWithBucketID("GET", url, nil, url)
		if err != nil {
			return nil, fmt.Errorf("fetch voters for answer %d: %w", answerID, err)
		}

		var resp pollVotersResponse
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, fmt.Errorf("decode voters response: %w", err)
		}

		if len(resp.Users) == 0 {
			break
		}

		for _, u := range resp.Users {
			allUsers = append(allUsers, u.ID)
		}

		if len(resp.Users) < 100 {
			break
		}
		after = resp.Users[len(resp.Users)-1].ID
	}

	return allUsers, nil
}

func main() {
	apply := false
	inspect := false
	for _, arg := range os.Args[1:] {
		switch arg {
		case "--apply":
			apply = true
		case "--inspect":
			inspect = true
		default:
			log.Fatalf("unknown flag: %s (use --inspect or --apply)", arg)
		}
	}

	token := os.Getenv("CHRONICLE_DISCORD_BOT_TOKEN")
	if token == "" {
		log.Fatal("CHRONICLE_DISCORD_BOT_TOKEN environment variable is required")
	}

	s, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatalf("create discord session: %v", err)
	}

	if channelID == "FILL_IN" {
		log.Fatal("channelID is not set — edit the const at the top of this file")
	}

	// Fetch the poll message to show answer mapping
	msg, err := s.ChannelMessage(channelID, messageID)
	if err != nil {
		log.Fatalf("fetch message: %v", err)
	}

	if msg.Poll == nil {
		log.Fatal("message does not contain a poll")
	}

	fmt.Println("Poll question:", msg.Poll.Question.Text)
	fmt.Println("Answers:")
	for _, a := range msg.Poll.Answers {
		roleID := answerToRole[a.AnswerID]
		if roleID == "" {
			roleID = "(no role mapped)"
		}
		fmt.Printf("  answer_id=%d  text=%q  → role %s\n",
			a.AnswerID, a.Media.Text, roleID)
	}

	if inspect {
		fmt.Println("\nDone inspecting. Use answer IDs above to fill in answerToRole map.")
		return
	}

	if !apply {
		fmt.Println("\n--- DRY RUN (pass --apply to assign roles) ---")
	}

	// Sort answer IDs for deterministic output
	var answerIDs []int
	for id := range answerToRole {
		answerIDs = append(answerIDs, id)
	}
	sort.Ints(answerIDs)

	summary := make(map[int]int)
	var errors []string

	for _, answerID := range answerIDs {
		roleID := answerToRole[answerID]
		voters, err := getPollVoters(s, channelID, messageID, answerID)
		if err != nil {
			log.Printf("ERROR fetching voters for answer %d: %v", answerID, err)
			continue
		}

		fmt.Printf("\nAnswer %d → role %s: %d voters\n", answerID, roleID, len(voters))
		summary[answerID] = len(voters)

		for _, userID := range voters {
			if apply {
				if err := s.GuildMemberRoleAdd(guildID, userID, roleID); err != nil {
					errMsg := fmt.Sprintf("  FAILED to add role to user %s: %v", userID, err)
					fmt.Println(errMsg)
					errors = append(errors, errMsg)
					continue
				}
				fmt.Printf("  ✓ assigned role to user %s\n", userID)
			} else {
				fmt.Printf("  would assign role to user %s\n", userID)
			}
		}
	}

	fmt.Println("\n=== Summary ===")
	for _, id := range answerIDs {
		fmt.Printf("  Answer %d: %d users\n", id, summary[id])
	}
	if len(errors) > 0 {
		fmt.Printf("  Errors: %d\n", len(errors))
		fmt.Println(strings.Join(errors, "\n"))
	}
	if !apply {
		fmt.Println("\nThis was a dry run. Pass --apply to actually assign roles.")
	}
}
