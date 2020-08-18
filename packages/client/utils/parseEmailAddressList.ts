import emailAddresses from 'email-addresses'

const parseEmailAddressList = (rawStr = '') => {
  // this breaks RFC5322 standards, but people are not standard :-(

  const commaDelimStr = rawStr
    // replace line breaks & semi colons with commas
    .replace(/(?:\r\n|\r|\n|;)/g, ',')
    // if the above created 2 commas (like a , + linebreak), remove dupes
    .replace(/,+/g, ',')
    // remove leading/trailing whitespace
    .trim()
    // remove trailing commas
    .replace(/,$/g, '')

  const commaDelimArr = commaDelimStr.split(', ')

  // check if the most recently added address is valid as parseAddressList
  // returns null if it's not
  const validAddresses = [] as string[]
  commaDelimArr.forEach((address) => {
    if (emailAddresses.parseOneAddress(address)) {
      validAddresses.push(address)
    }
  })

  const updatedCommaDelimStr = validAddresses.join(', ')
  return emailAddresses.parseAddressList(updatedCommaDelimStr)
}

export default parseEmailAddressList
