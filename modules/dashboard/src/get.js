import axios from "axios";

const publicUrl = process.env.PUBLIC_URL || `http://localhost:3000`
const apiUrl = process.env.REACT_APP_API_URL || `${publicUrl}/api/dashboard`

const get = async (url) => {
    const res = await axios.get(`${apiUrl}/${url}`)
    if (res.data && res.data.length === 1) {
      console.log(`Got one from ${url}: ${res.data[0]}`)
      return res.data[0]
    } else if (res.data && res.data.length >= 1) {
      console.log(`Got ${res.data.length} from ${url}: ${res.data}`)
      return res.data
    } else {
      console.warn(`Couldn't get ${url}: ${res}`)
      return null
    }
}

export default get
