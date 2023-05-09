const networkConfig = {
    default: {
      name: "hardhat",
    },
    31337: {
      name: "localhost",
    },
  };
  
  const developmentChains = ["hardhat", "localhost"];
  
  module.exports = {
    networkConfig,
    developmentChains,
  };