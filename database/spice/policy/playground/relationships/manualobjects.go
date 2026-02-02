package relationships

import (
	"context"

	"github.com/Emyrk/chronicle/database/spice/policy"
	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
)

var Playground = NewRelationships()

// Relationships is a wrapper around the policy builder. The policy builder will
// keep track of new relationships. This wrapper keeps track of permission checks
// (either should be true or false) and validations. These are all concepts
// on the authzed playground.
// https://play.authzed.com/
type Relationships struct {
	*policy.Builder
	True        []v1.Relationship
	False       []v1.Relationship
	Validations []v1.Relationship
}

func NewRelationships() *Relationships {
	return &Relationships{
		Builder:     policy.New(),
		True:        []v1.Relationship{},
		False:       []v1.Relationship{},
		Validations: []v1.Relationship{},
	}
}

type PermCheck = func(ctx context.Context) (context.Context, string, *v1.ObjectReference)

// Validations will emit all users who can do this
func (r *Relationships) Validate(checks ...PermCheck) *Relationships {
	for _, check := range checks {
		_, permission, obj := check(context.Background())
		r.Validations = append(r.Validations, v1.Relationship{
			Resource: obj,
			Relation: permission,
		})
	}

	return r
}

func (r *Relationships) AssertTrue(check PermCheck, subjects ...policy.AuthzedObject) *Relationships {
	for _, subject := range subjects {
		subject := subject
		r.True = append(r.True, r.assert(subject.AsSubject(), check))
	}
	return r
}

func (r *Relationships) AssertFalse(check PermCheck, subjects ...policy.AuthzedObject) *Relationships {
	for _, subject := range subjects {
		subject := subject
		r.False = append(r.False, r.assert(subject.AsSubject(), check))
	}
	return r
}

func (r *Relationships) assert(subject *v1.SubjectReference, check PermCheck) v1.Relationship {
	_, permission, obj := check(context.Background())
	return v1.Relationship{
		Resource:       obj,
		Relation:       permission,
		Subject:        subject,
		OptionalCaveat: nil,
	}
}

func (r Relationships) AllValidations() []v1.Relationship {
	return r.Validations
}

//func WorkspaceWithDeps(id string, organization *policy.ObjOrganization, template *policy.ObjTemplate, user *policy.ObjUser) *policy.ObjWorkspace {
//	// Perm checks: can use template, and can create workspace in org
//	Playground.AssertTrue(template.CanUse, user)
//	Playground.AssertTrue(organization.CanCreate_workspace, user)
//
//	workspace := Playground.Workspace(policy.String(id)).
//		Organization(organization).
//		For_userUser(user)
//
//	//build := Workspace_build(fmt.Sprintf("%s/build", id)).
//	//	Workspace(workspace)
//	//agent := Workspace_agent(fmt.Sprintf("%s/agent", id)).
//	//	Workspace(workspace)
//	//// app := Worspace_app(fmt.Sprintf("%s/app", id)).
//	////	Workspace(workspace)
//	//resources := Workspace_resources(fmt.Sprintf("%s/resources", id)).
//	//	Workspace(workspace)
//
//	// Add the template + provisioner relationship
//	template.Workspace(workspace)
//
//	//var _, _, _ = build, agent, resources
//	return workspace
//}
