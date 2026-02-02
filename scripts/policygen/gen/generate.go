package gen

import (
	_ "embed"
	"fmt"
	"go/format"
	"regexp"
	"sort"
	"strings"
	"text/template"

	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
	core "github.com/authzed/spicedb/pkg/proto/core/v1"
	"github.com/authzed/spicedb/pkg/schemadsl/compiler"
	"github.com/authzed/spicedb/pkg/schemadsl/generator"
	"github.com/authzed/spicedb/pkg/tuple"
	"golang.org/x/exp/slices"
	"golang.org/x/xerrors"
)

//go:embed relationships.go.tmpl
var templateText string

//go:embed header.go.tmpl
var templateHeader string

type GenerateOptions struct {
	Package  string
	Filename string
}

func Generate(schema string, opts GenerateOptions) (string, error) {
	if opts.Package == "" {
		opts.Package = "policy"
	}

	var prefix string
	compiled, err := compiler.Compile(compiler.InputSchema{
		Source:       "policy.zed",
		SchemaString: schema,
	}, compiler.ObjectTypePrefix(prefix))
	if err != nil {
		return "", xerrors.Errorf("compile schema: %w", err)
	}

	tpl, err := template.New("relationships.tmpl").Funcs(template.FuncMap{
		"capitalize": capitalize,
		"comment":    comment,
	}).Parse(templateText)
	if err != nil {
		return "", xerrors.Errorf("parse template: %w", err)
	}

	header, err := template.New("header.tmpl").Parse(templateHeader)
	if err != nil {
		return "", xerrors.Errorf("parse header template: %w", err)
	}

	// This is specific to chronicle. For ease of use of the site wide "chronicle", having
	// a method to reference the same platform is useful. If the platform object is not
	// present, then we will omit this.
	includeChronicleGlobal := false
	for _, obj := range compiled.ObjectDefinitions {
		if obj.Name == "chronicle" {
			includeChronicleGlobal = true
			break
		}
	}

	var output strings.Builder
	// Write the file header first
	err = header.Execute(&output, map[string]interface{}{
		"Package":                opts.Package,
		"IncludeChronicleGlobal": includeChronicleGlobal,
	})
	if err != nil {
		return "", xerrors.Errorf("execute header template: %w", err)
	}

	// If you do not write this, there is no line break between them.
	output.WriteString("\n")

	// sort order for consistency
	sort.Slice(compiled.ObjectDefinitions, func(i, j int) bool {
		return compiled.ObjectDefinitions[i].Name < compiled.ObjectDefinitions[j].Name
	})
	// TODO: Handle caveats
	sort.Slice(compiled.CaveatDefinitions, func(i, j int) bool {
		return compiled.CaveatDefinitions[i].Name < compiled.CaveatDefinitions[j].Name
	})

	definitions := make(map[string]objectDefinition, len(compiled.ObjectDefinitions))
	for _, obj := range compiled.ObjectDefinitions {
		d := newDef(obj)
		d.Filename = opts.Filename
		definitions[d.Name] = d
	}

	// Add optional relations
	for k := range definitions {
		// For each optional relation, lets add it to the other defintion
		for _, opt := range definitions[k].OptionalRelations {
			if includeOpt, ok := definitions[opt.For]; ok {
				index := slices.IndexFunc(includeOpt.IncludeRelations, func(i includedRelation) bool {
					return i.RelationName == opt.Relation
				})

				if index == -1 {
					includeOpt.IncludeRelations = append(includeOpt.IncludeRelations, includedRelation{
						RelationName: opt.Relation,
						From:         []string{opt.From},
					})
				} else {
					includeOpt.IncludeRelations[index].From = append(includeOpt.IncludeRelations[index].From, opt.From)
				}

				definitions[opt.For] = includeOpt
			}
		}
	}

	sorted := make([]objectDefinition, 0, len(definitions))
	for k := range definitions {
		sorted = append(sorted, definitions[k])
	}

	// Sort for a consistent output order
	slices.SortStableFunc(sorted, func(a, b objectDefinition) int {
		return strings.Compare(a.Name, b.Name)
	})

	for _, obj := range sorted {
		err := tpl.Execute(&output, obj)
		if err != nil {
			return "", xerrors.Errorf("[%q] execute template: %w", obj.Name, err)
		}
		output.WriteString("\n")
	}

	formatted, err := format.Source([]byte(output.String()))
	if err != nil {
		// Return the failed output for debugging.
		return output.String(), xerrors.Errorf("format source: %w", err)
	}
	return string(formatted), nil
}

// objectDefinition is the type used for the template generator.
type objectDefinition struct {
	// The core type
	*core.NamespaceDefinition

	Filename        string
	DirectRelations []objectDirectRelation
	// RelationConstants are the names of the relations that are defined in the schema.
	// This just makes it easier to reference the relations in the code.
	RelationConstants map[string]struct{}
	Permissions       []objectPermission
	// OptionalRelations keep track of which optional relations are being
	// referenced in this object definition. We can use this to make helpers
	// to add optional relations when using the object as a subject.
	//
	// OptionalRelations can reference other objects.
	OptionalRelations []optionalRelation
	// IncludeRelations are which to include in the generated file.
	IncludeRelations []includedRelation
}

type includedRelation struct {
	RelationName string
	From         []string
}

type optionalRelation struct {
	For      string
	Relation string
	From     string
}

type objectDirectRelation struct {
	LinePos      string
	Comment      string
	RelationName string
	FunctionName string
	Subject      v1.SubjectReference
}

type objectPermission struct {
	LinePos      string
	Comment      string
	Permission   string
	FunctionName string
}

var permissionSchema = regexp.MustCompile(`^[^{]*{\s*(.*)\s}$`)

func newDef(obj *core.NamespaceDefinition) objectDefinition {
	parsedObject := objectDefinition{
		NamespaceDefinition: obj,
		RelationConstants:   make(map[string]struct{}),
	}
	rels := make([]objectDirectRelation, 0)
	perms := make([]objectPermission, 0)
	optRels := make([]optionalRelation, 0)

	objectReference := &v1.ObjectReference{
		ObjectType: obj.Name,
		ObjectId:   "<id>",
	}

	// Each relation is a "relation" or "permission" line in the schema. Example:
	// - relation member: group#membership | user
	// - permission membership = member
	for _, r := range obj.Relation {
		linePos := fmt.Sprintf("%d", r.SourcePosition.ZeroIndexedLineNumber+1)
		// A UsersetRewrite is a permission. In spicedb, permissions are just
		// dynamically created relations.
		if r.UsersetRewrite != nil {
			comment := fmt.Sprintf("Object: %s", tuple.V1StringObjectRef(objectReference))
			// The UsersetRewrite is an expression shown as an AST here.
			// The code to parse the AST is all in the `/internal` pkg, and
			// writing our own AST traversal is not worth it just to place
			// a helpful comment.
			//
			// Instead, we use the 'GenerateSource' to effectively generate the
			// schema block. With a bit of regex, we can extract what we want.
			schema, _, _ := generator.GenerateSource(&core.NamespaceDefinition{
				Name:           obj.Name,
				Relation:       []*core.Relation{r},
				Metadata:       obj.Metadata,
				SourcePosition: obj.SourcePosition,
			}, nil)
			matches := permissionSchema.FindStringSubmatch(schema)
			if len(matches) >= 2 {
				comment += "\nSchema: " + matches[1]
			}

			// For our case, we only care about the permissions name.
			// If we decided to actually parse the AST, we could extract which
			// relations that the permission is mapping to.
			// With that information, we could add some sort of validation or
			// type safety to ensure subjects passed in are in fact valid subjects.
			//
			// Right now, you could pass in any object to the "CanX" function, and
			// it will try even though we know some objects will never have the permission.
			perms = append(perms, objectPermission{
				LinePos:      linePos,
				Comment:      strings.TrimSpace(comment),
				Permission:   r.Name,
				FunctionName: capitalize(r.Name),
			})
			continue
		}

		// Each "AllowedDirectRelations" is a "subject" on the right hand side
		// of a relation. So in the example above, the subjects are:
		//	- group#membership
		//	- user
		multipleSubjects := make([]objectDirectRelation, 0)
		for _, d := range r.TypeInformation.AllowedDirectRelations {
			optRel := ""
			// TODO: I cannot recall what this is
			if d.GetRelation() != "..." {
				optRel = d.GetRelation()
			}

			if optRel != "" {
				// An optional relation means we are not relating the parent "obj" to
				// the "r" directly.
				//
				// The common example is 'group#membership'.
				// If a relationship from "Obj A" -> "Group B" exists.
				// Then checking if "Group B" can read "Obj A" is a valid check, but it
				// will fail. Because the check **should be** if "Group B#membership" can read "Obj A".
				//
				// So in our autogenerated output, we have a "AsSubject()" function. We can do a bit better
				// and add a "AsAnyMembership()" to the "Group" Object.
				from := tuple.V1StringSubjectRef(&v1.SubjectReference{
					Object: &v1.ObjectReference{
						ObjectType: obj.Name,
						ObjectId:   "<id>",
					},
					OptionalRelation: r.Name,
				})

				optRels = append(optRels, optionalRelation{
					For:      d.Namespace,
					Relation: d.GetRelation(),
					From:     from,
				})
			}

			subj := v1.SubjectReference{
				Object: &v1.ObjectReference{
					ObjectType: d.Namespace,
					// This ObjectID will be overwritten, so just use a placeholder.
					ObjectId: "<id>",
				},
				OptionalRelation: optRel,
			}

			if d.GetPublicWildcard() != nil {
				subj.Object.ObjectId = "*"
			}

			// Generate a comment above the function that is the string representation
			// of the relationship that the function will create.
			// The format is:
			//	<obj_typ>:<obj_id>#<relation>@<subj_typ>:<subj_id>
			comment, _ := tuple.V1StringRelationship(&v1.Relationship{
				Resource:       objectReference,
				Relation:       r.Name,
				Subject:        &subj,
				OptionalCaveat: nil,
			})
			parsedObject.RelationConstants[r.Name] = struct{}{}
			multipleSubjects = append(multipleSubjects, objectDirectRelation{
				LinePos:      linePos,
				Comment:      fmt.Sprintf("Relationship: %s", comment),
				RelationName: r.Name,
				FunctionName: r.Name,
				Subject:      subj,
			})
		}

		// If we have more than 1 subject, we need to suffix the name of the function with the
		// object type. Otherwise, we have 2 functions with the same name.
		//
		// Example:
		//	- group#member -- func MemberGroup
		//	- user  	   -- func MemberUser
		//
		// If we only have 1 subject, we do not need the suffix.
		// If someone could find a typesafe argument pattern with generics, that would be great.
		if len(multipleSubjects) > 1 {
			for i := range multipleSubjects {
				multipleSubjects[i].FunctionName += capitalize(multipleSubjects[i].Subject.Object.ObjectType)
			}
		}

		rels = append(rels, multipleSubjects...)
	}
	parsedObject.DirectRelations = rels
	parsedObject.Permissions = perms
	parsedObject.OptionalRelations = optRels
	return parsedObject
}

func capitalize(name string) string {
	return strings.ToUpper(string(name[0])) + name[1:]
}

func comment(body string) string {
	return "// " + strings.Join(strings.Split(body, "\n"), "\n// ")
}
