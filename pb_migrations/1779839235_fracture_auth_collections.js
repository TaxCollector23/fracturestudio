migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new SelectField({
    name: "provider",
    maxSelect: 1,
    values: ["email", "google"],
  }))
  users.fields.add(new DateField({
    name: "lastSeen",
  }))
  app.save(users)

  const projects = new Collection({
    type: "base",
    name: "projects",
    listRule: "@request.auth.id != '' && owner = @request.auth.id",
    viewRule: "@request.auth.id != '' && owner = @request.auth.id",
    createRule: "@request.auth.id != '' && owner = @request.auth.id",
    updateRule: "@request.auth.id != '' && owner = @request.auth.id",
    deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    fields: [
      {
        type: "relation",
        name: "owner",
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      },
      {
        type: "text",
        name: "title",
        required: true,
        max: 140,
      },
      {
        type: "editor",
        name: "draft",
        required: true,
      },
      {
        type: "json",
        name: "analysis",
        maxSize: 3000000,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE INDEX idx_projects_owner_updated ON projects (owner, updated)",
    ],
  })
  app.save(projects)

  const preferences = new Collection({
    type: "base",
    name: "preferences",
    listRule: "@request.auth.id != '' && owner = @request.auth.id",
    viewRule: "@request.auth.id != '' && owner = @request.auth.id",
    createRule: "@request.auth.id != '' && owner = @request.auth.id",
    updateRule: "@request.auth.id != '' && owner = @request.auth.id",
    deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    fields: [
      {
        type: "relation",
        name: "owner",
        required: true,
        maxSelect: 1,
        collectionId: users.id,
        cascadeDelete: true,
      },
      {
        type: "json",
        name: "options",
        required: true,
        maxSize: 50000,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_preferences_owner ON preferences (owner)",
    ],
  })
  app.save(preferences)
}, (app) => {
  for (const collectionName of ["preferences", "projects"]) {
    try {
      app.delete(app.findCollectionByNameOrId(collectionName))
    } catch (_) {}
  }
})
