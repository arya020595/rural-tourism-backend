const UserPolicy = require("./userPolicy");

const POLICY_MAP = {
  user: UserPolicy,
};

/**
 * Resolve the policy class for a given resource name.
 *
 * @param {string} resourceName – e.g. "user"
 * @param {object} currentUser  – req.user from JWT
 * @param {object} [record]     – optional target record for per-record checks
 * @returns {ApplicationPolicy}
 */
function policy(resourceName, currentUser, record = null) {
  const PolicyClass = POLICY_MAP[resourceName];
  if (!PolicyClass) {
    throw new Error(`No policy defined for resource "${resourceName}"`);
  }
  return new PolicyClass(currentUser, record);
}

/**
 * Returns the scoping `where` clause for a resource.
 *
 * @param {string} resourceName
 * @param {object} currentUser
 * @returns {object} Sequelize where clause
 */
function policyScope(resourceName, currentUser) {
  return policy(resourceName, currentUser).scope();
}

module.exports = { policy, policyScope };
