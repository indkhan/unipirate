// Exercise the same candidates that seed creates. Production evaluation reads
// reviewed rows from the database, never this bootstrap module.
export { ruleData as fixtureRules } from "../../../scripts/rules.bootstrap";
